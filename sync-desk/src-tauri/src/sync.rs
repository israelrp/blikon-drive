use std::{path::PathBuf, sync::{Arc, Mutex}, time::Duration};
use notify::{RecommendedWatcher, RecursiveMode, Watcher, Event, EventKind};
use reqwest::Client;
use tauri::{AppHandle, Emitter, async_runtime};
use chrono::Utc;
use uuid::Uuid;

use crate::{db, models::{AppConfig, SyncEntry}, upload};

pub struct SyncState {
    pub config:   AppConfig,
    pub paused:   bool,
    pub watcher:  Option<RecommendedWatcher>,
    pub syncing:  bool,   // evita run_sync concurrentes
}

/// Emite un log al frontend (visible en DevTools) y a stdout.
fn slog(app: &AppHandle, msg: impl Into<String>) {
    let m = msg.into();
    println!("[Sync] {m}");
    app.emit("sync_log", &m).ok();
}

/// Resetea `syncing=false` al salir de run_sync, SIEMPRE (incluso en panic o
/// return temprano). Evita que un sync atascado bloquee todos los futuros.
struct SyncGuard(Arc<Mutex<SyncState>>);
impl Drop for SyncGuard {
    fn drop(&mut self) {
        if let Ok(mut s) = self.0.lock() {
            s.syncing = false;
        }
    }
}

/// Llama a /api/folders/ensure para crear el folder y toda su cadena de padres.
/// Timeout corto para no colgar el sync si un POST se traba.
async fn ensure_folder(client: &Client, api_url: &str, blikon_id: &str, path: &str) {
    let res = client
        .post(format!("{api_url}/api/folders/ensure"))
        .header("X-Blikon-Id", blikon_id)
        .json(&serde_json::json!({ "path": path }))
        .timeout(Duration::from_secs(20))
        .send()
        .await;
    if let Err(e) = res {
        log::warn!("ensure_folder '{}' falló: {}", path, e);
    }
}

/// Slugifica un segmento de carpeta igual que el API: minúsculas, espacios→guión,
/// solo [a-z0-9-]. Evita IDs con espacios/mayúsculas que no coinciden con el server.
fn slug_segment(s: &str) -> String {
    let lower = s.to_lowercase();
    let mut out = String::with_capacity(lower.len());
    let mut prev_dash = false;
    for ch in lower.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch);
            prev_dash = false;
        } else if ch == '-' || ch == '_' || ch.is_whitespace() {
            if !prev_dash && !out.is_empty() { out.push('-'); prev_dash = true; }
        }
        // otros caracteres se ignoran
    }
    while out.ends_with('-') { out.pop(); }
    out
}

/// Carpetas que NUNCA se sincronizan (basura inequívoca: deps, VCS, sistema).
fn is_ignored_dir(name: &str) -> bool {
    matches!(name,
        "node_modules" | "$RECYCLE.BIN" | "System Volume Information" | "__pycache__"
    ) || name.starts_with('.')   // .git, .svn, .cache, .DS_Store, etc.
}

/// Recopila recursivamente todos los archivos bajo `dir` — SOLO filesystem, sin red.
/// Devuelve vec de (ruta_absoluta_archivo, core_folder_id).
/// NO sigue symlinks/junctions (evita loops infinitos en discos de respaldo Windows).
/// Límite de profundidad 40 como salvaguarda extra.
fn collect_files_recursive(
    app:            &AppHandle,
    dir:            &PathBuf,
    base_folder_id: &str,
    depth:          u32,
    count:          &mut usize,
) -> Vec<(PathBuf, String)> {
    let mut result = Vec::new();
    if depth > 40 {
        slog(app, format!("profundidad máxima en {:?}, omitido", dir));
        return result;
    }

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(e) => {
            slog(app, format!("no se pudo leer {:?}: {}", dir, e));
            return result;
        }
    };

    for entry in entries.flatten() {
        // file_type() NO sigue symlinks — clave para no entrar en junctions de Windows
        let ft = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        if ft.is_symlink() { continue; }

        let path = entry.path();

        if ft.is_file() {
            result.push((path, base_folder_id.to_string()));
            *count += 1;
            if *count % 500 == 0 {
                slog(app, format!("… {} archivos recorridos", count));
            }
        } else if ft.is_dir() {
            let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            if is_ignored_dir(&name) { continue; }
            let slug = slug_segment(&name);
            if slug.is_empty() { continue; }
            let sub_folder_id = format!("{}/{}", base_folder_id, slug);

            let mut sub = collect_files_recursive(app, &path, &sub_folder_id, depth + 1, count);
            result.append(&mut sub);
        }
    }

    result
}

pub async fn run_sync(
    app:   AppHandle,
    state: Arc<Mutex<SyncState>>,
    conn:  Arc<Mutex<rusqlite::Connection>>,
) {
    // Guard anti-concurrencia: si ya hay un sync corriendo, salimos.
    {
        let mut s = state.lock().unwrap();
        if s.syncing {
            slog(&app, "run_sync ya en curso — omitiendo llamada duplicada");
            return;
        }
        s.syncing = true;
    }
    // Garantiza syncing=false al salir, pase lo que pase.
    let _guard = SyncGuard(Arc::clone(&state));

    let config = { state.lock().unwrap().config.clone() };
    slog(&app, format!("run_sync: {} folder(s), api={}, blikonId={}",
        config.sync_folders.len(), config.api_url, config.blikon_id));
    if config.sync_folders.is_empty() {
        slog(&app, "sin folders configurados — nada que sincronizar");
        return;
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(300))
        .build()
        .unwrap();

    for folder in &config.sync_folders {
        if !folder.enabled {
            slog(&app, format!("folder '{}' deshabilitado, omitido", folder.core_folder_id));
            continue;
        }

        let root_path = PathBuf::from(&folder.local_path);
        if !root_path.exists() {
            slog(&app, format!("carpeta local NO existe: {:?}", root_path));
            continue;
        }

        slog(&app, format!("sincronizando '{}' ← {:?}", folder.core_folder_id, root_path));

        // 1. Recorrido rápido del filesystem (sin red, sin symlinks)
        let mut count = 0usize;
        let files = collect_files_recursive(&app, &root_path, &folder.core_folder_id, 0, &mut count);
        slog(&app, format!("{} archivo(s) encontrado(s) en '{}'", files.len(), folder.core_folder_id));

        // 2. Filtrar los que faltan por subir
        let pending: Vec<_> = files.into_iter().filter(|(p, _)| {
            let c = conn.lock().unwrap();
            !db::entry_exists_synced(&c, &p.to_string_lossy())
        }).collect();
        slog(&app, format!("{} archivo(s) pendiente(s) por subir", pending.len()));

        // 3. Asegurar (una vez) cada folder único que tiene archivos pendientes.
        //    El API crea toda la cadena de padres, así que basta con el folder hoja.
        let mut ensured = std::collections::HashSet::new();
        for (_, fid) in &pending {
            if ensured.insert(fid.clone()) {
                ensure_folder(&client, &config.api_url, &config.blikon_id, fid).await;
            }
        }
        if !ensured.is_empty() {
            slog(&app, format!("{} folder(s) asegurado(s) en Drive", ensured.len()));
        }

        let files = pending;

        for (file_path, core_folder_id) in files {
            if state.lock().unwrap().paused { return; }

            let file_name  = file_path.file_name().unwrap().to_string_lossy().to_string();
            let size_bytes = file_path.metadata().map(|m| m.len() as i64).unwrap_or(0);
            let entry_id   = Uuid::new_v4().to_string();
            let folder_id  = folder.id.clone();

            // Emitir estado: uploading
            let uploading = SyncEntry {
                id: entry_id.clone(), sync_folder_id: folder_id.clone(),
                file_name: file_name.clone(),
                local_path: file_path.to_string_lossy().to_string(),
                file_id: None, size_bytes,
                status: "uploading".into(), progress: 0,
                error: None, updated_at: Utc::now().to_rfc3339(),
            };
            { db::upsert_entry(&conn.lock().unwrap(), &uploading).ok(); }
            app.emit("sync_entry_updated", &uploading).ok();

            // Subir con progreso
            let app_clone = app.clone();
            let eid       = entry_id.clone();
            let fname     = file_name.clone();
            let lpath     = file_path.to_string_lossy().to_string();
            let fid       = folder_id.clone();
            let sz        = size_bytes;

            let result = upload::upload_file(
                &client,
                &config.api_url,
                &config.blikon_id,
                &core_folder_id,
                &file_path,
                move |pct| {
                    let progress = SyncEntry {
                        id: eid.clone(), sync_folder_id: fid.clone(),
                        file_name: fname.clone(), local_path: lpath.clone(),
                        file_id: None, size_bytes: sz,
                        status: "uploading".into(), progress: pct,
                        error: None, updated_at: Utc::now().to_rfc3339(),
                    };
                    app_clone.emit("sync_entry_updated", &progress).ok();
                },
            ).await;

            let final_entry = match result {
                Ok(file_id) => {
                    slog(&app, format!("✓ subido '{}' → {}", file_name, file_id));
                    SyncEntry {
                        id: entry_id, sync_folder_id: folder_id,
                        file_name, local_path: file_path.to_string_lossy().to_string(),
                        file_id: Some(file_id), size_bytes,
                        status: "synced".into(), progress: 100,
                        error: None, updated_at: Utc::now().to_rfc3339(),
                    }
                }
                Err(e) => {
                    slog(&app, format!("✗ error subiendo '{}': {}", file_name, e));
                    SyncEntry {
                        id: entry_id, sync_folder_id: folder_id,
                        file_name, local_path: file_path.to_string_lossy().to_string(),
                        file_id: None, size_bytes,
                        status: "error".into(), progress: 0,
                        error: Some(e.to_string()), updated_at: Utc::now().to_rfc3339(),
                    }
                }
            };

            { db::upsert_entry(&conn.lock().unwrap(), &final_entry).ok(); }
            app.emit("sync_entry_updated", &final_entry).ok();
        }
    }

    slog(&app, "sync completado");
    // _guard se dropea aquí → syncing = false
}

pub fn start_watcher(
    app:   AppHandle,
    state: Arc<Mutex<SyncState>>,
    conn:  Arc<Mutex<rusqlite::Connection>>,
) {
    let paths: Vec<PathBuf> = {
        let s = state.lock().unwrap();
        s.config.sync_folders.iter()
            .filter(|f| f.enabled)
            .map(|f| PathBuf::from(&f.local_path))
            .collect()
    };

    let (tx, rx) = std::sync::mpsc::channel::<()>();

    let mut watcher = match notify::recommended_watcher(move |res: notify::Result<Event>| {
        if let Ok(event) = res {
            if matches!(event.kind, EventKind::Create(_) | EventKind::Modify(_)) {
                tx.send(()).ok();
            }
        }
    }) {
        Ok(w) => w,
        Err(e) => {
            log::error!("No se pudo crear el file watcher: {}", e);
            return;
        }
    };

    for path in &paths {
        if path.exists() {
            // Recursivo — detecta cambios en subcarpetas también
            if let Err(e) = watcher.watch(path, RecursiveMode::Recursive) {
                log::warn!("No se pudo observar {:?}: {}", path, e);
            }
        } else {
            log::warn!("Carpeta no encontrada, omitida: {:?}", path);
        }
    }

    state.lock().unwrap().watcher = Some(watcher);

    let app2   = app.clone();
    let state2 = Arc::clone(&state);
    let conn2  = Arc::clone(&conn);

    std::thread::spawn(move || {
        while rx.recv().is_ok() {
            // Debounce 500ms
            std::thread::sleep(Duration::from_millis(500));
            while rx.try_recv().is_ok() {}

            let app3   = app2.clone();
            let state3 = Arc::clone(&state2);
            let conn3  = Arc::clone(&conn2);

            async_runtime::block_on(async move {
                run_sync(app3, state3, conn3).await;
            });
        }
    });
}

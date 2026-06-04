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

/// Recorre `dir` acumulando en `out` SOLO archivos NO sincronizados, hasta `cap`.
/// SOLO filesystem (sin red). NO sigue symlinks/junctions. Profundidad máx 40.
/// Saltar los ya sincronizados durante el recorrido acota memoria y permite
/// procesar folders enormes (cientos de miles de archivos) en lotes.
#[allow(clippy::too_many_arguments)]
fn collect_files_recursive(
    app:            &AppHandle,
    dir:            &PathBuf,
    base_folder_id: &str,
    depth:          u32,
    synced:         &std::collections::HashSet<String>,
    out:            &mut Vec<(PathBuf, String)>,
    scanned:        &mut usize,
    cap:            usize,
) {
    if out.len() >= cap { return; }
    if depth > 40 {
        slog(app, format!("profundidad máxima en {:?}, omitido", dir));
        return;
    }

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(e) => {
            slog(app, format!("no se pudo leer {:?}: {}", dir, e));
            return;
        }
    };

    for entry in entries.flatten() {
        if out.len() >= cap { return; }

        // file_type() NO sigue symlinks — clave para no entrar en junctions de Windows
        let ft = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        if ft.is_symlink() { continue; }

        let path = entry.path();

        if ft.is_file() {
            *scanned += 1;
            if *scanned % 5000 == 0 {
                slog(app, format!("… {} archivos revisados, {} por subir en este lote", scanned, out.len()));
            }
            // Saltar los ya sincronizados — no los cargamos a memoria
            if !synced.contains(path.to_string_lossy().as_ref()) {
                out.push((path, base_folder_id.to_string()));
            }
        } else if ft.is_dir() {
            let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            if is_ignored_dir(&name) { continue; }
            let slug = slug_segment(&name);
            if slug.is_empty() { continue; }
            let sub_folder_id = format!("{}/{}", base_folder_id, slug);

            collect_files_recursive(app, &path, &sub_folder_id, depth + 1, synced, out, scanned, cap);
        }
    }
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

    // Procesamos en lotes de BATCH archivos por pasada para acotar memoria.
    // Si un lote se llena, re-disparamos run_sync al final hasta vaciar todo.
    const BATCH: usize = 3000;
    let mut batch_full = false;

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

        // Cargar paths ya sincronizados (una query) para saltarlos en el recorrido.
        let synced = { db::synced_paths(&conn.lock().unwrap()) };

        // 1. Recorrido: acumula SOLO no-sincronizados, hasta BATCH (acota memoria
        //    y permite procesar folders con cientos de miles de archivos por lotes).
        let mut pending: Vec<(PathBuf, String)> = Vec::new();
        let mut scanned = 0usize;
        collect_files_recursive(
            &app, &root_path, &folder.core_folder_id, 0,
            &synced, &mut pending, &mut scanned, BATCH,
        );
        let total = pending.len();
        if total >= BATCH { batch_full = true; }
        slog(&app, format!("{} archivo(s) por subir en este lote (de {} revisados)", total, scanned));

        // 2. Subir: aseguramos cada folder de forma LAZY justo antes de su primer
        //    archivo (el API crea la cadena de padres). Así el upload empieza de
        //    inmediato sin esperar a asegurar miles de folders primero.
        let mut ensured = std::collections::HashSet::new();
        let mut done = 0usize;
        if total > 0 { slog(&app, "iniciando subida de archivos…"); }

        for (file_path, core_folder_id) in pending {
            if state.lock().unwrap().paused {
                slog(&app, "sync pausado");
                return;
            }

            done += 1;
            if done == 1 || done % 100 == 0 {
                slog(&app, format!("subiendo {} de {}", done, total));
            }

            // Asegurar el folder de este archivo (una sola vez)
            if ensured.insert(core_folder_id.clone()) {
                slog(&app, format!("asegurando folder '{}'", core_folder_id));
                ensure_folder(&client, &config.api_url, &config.blikon_id, &core_folder_id).await;
            }

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

    // Si algún folder llenó el lote, quedan más archivos → re-disparar otra pasada.
    if batch_full && !state.lock().unwrap().paused {
        slog(&app, "lote completo, continuando con el siguiente…");
        drop(_guard);   // libera syncing antes de re-lanzar
        let app2 = app.clone();
        let s2 = Arc::clone(&state);
        let c2 = Arc::clone(&conn);
        async_runtime::spawn(async move { Box::pin(run_sync(app2, s2, c2)).await; });
        return;
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

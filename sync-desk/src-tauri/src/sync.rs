use std::{path::PathBuf, sync::{Arc, Mutex}, time::Duration};
use notify::{RecommendedWatcher, RecursiveMode, Watcher, Event, EventKind};
use reqwest::Client;
use tauri::{AppHandle, Emitter, async_runtime};
use chrono::Utc;
use uuid::Uuid;

use crate::{db, models::{AppConfig, SyncEntry}, upload};

pub struct SyncState {
    pub config:  AppConfig,
    pub paused:  bool,
    pub watcher: Option<RecommendedWatcher>,
}

/// Llama a /api/folders/ensure para crear el folder y toda su cadena de padres.
async fn ensure_folder(client: &Client, api_url: &str, crono_code: &str, path: &str) {
    let _ = client
        .post(format!("{api_url}/api/folders/ensure"))
        .header("X-Crono-Code", crono_code)
        .json(&serde_json::json!({ "path": path }))
        .send()
        .await;
}

/// Recopila recursivamente todos los archivos bajo `dir`.
/// Devuelve vec de (ruta_absoluta_archivo, core_folder_id).
/// Las subcarpetas se mapean como "{base_folder_id}/{relpath_de_subcarpeta}".
async fn collect_files_recursive(
    dir:            &PathBuf,
    root:           &PathBuf,
    base_folder_id: &str,
    client:         &Client,
    api_url:        &str,
    crono_code:     &str,
) -> Vec<(PathBuf, String)> {
    let mut result = Vec::new();

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(e) => {
            log::warn!("No se pudo leer {:?}: {}", dir, e);
            return result;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();

        if path.is_file() {
            result.push((path, base_folder_id.to_string()));
        } else if path.is_dir() {
            // Calcular el folder ID de la subcarpeta como "base/relpath"
            let rel = path.strip_prefix(root).unwrap_or(&path);
            let rel_str = rel.to_string_lossy().replace('\\', "/");
            let sub_folder_id = format!("{}/{}", base_folder_id, rel_str);

            // Asegurarnos de que el folder exista en Drive
            ensure_folder(client, api_url, crono_code, &sub_folder_id).await;

            // Descender recursivamente
            let mut sub = Box::pin(collect_files_recursive(
                &path,
                root,
                &sub_folder_id,
                client,
                api_url,
                crono_code,
            )).await;
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
    let config = { state.lock().unwrap().config.clone() };
    if config.sync_folders.is_empty() { return; }

    let client = Client::builder()
        .timeout(Duration::from_secs(300))
        .build()
        .unwrap();

    for folder in &config.sync_folders {
        if !folder.enabled { continue; }

        let root_path = PathBuf::from(&folder.local_path);
        if !root_path.exists() {
            log::warn!("Carpeta local no encontrada: {:?}", root_path);
            continue;
        }

        // Asegurar que el folder raíz existe en Drive
        ensure_folder(&client, &config.api_url, &config.crono_code, &folder.core_folder_id).await;

        // Recopilar todos los archivos recursivamente
        let files = collect_files_recursive(
            &root_path,
            &root_path,
            &folder.core_folder_id,
            &client,
            &config.api_url,
            &config.crono_code,
        ).await;

        for (file_path, core_folder_id) in files {
            if state.lock().unwrap().paused { return; }

            // Skip si ya está sincronizado
            let already = {
                let c = conn.lock().unwrap();
                db::entry_exists_synced(&c, &file_path.to_string_lossy())
            };
            if already { continue; }

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
                &config.crono_code,
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
                Ok(file_id) => SyncEntry {
                    id: entry_id, sync_folder_id: folder_id,
                    file_name, local_path: file_path.to_string_lossy().to_string(),
                    file_id: Some(file_id), size_bytes,
                    status: "synced".into(), progress: 100,
                    error: None, updated_at: Utc::now().to_rfc3339(),
                },
                Err(e) => SyncEntry {
                    id: entry_id, sync_folder_id: folder_id,
                    file_name, local_path: file_path.to_string_lossy().to_string(),
                    file_id: None, size_bytes,
                    status: "error".into(), progress: 0,
                    error: Some(e.to_string()), updated_at: Utc::now().to_rfc3339(),
                },
            };

            { db::upsert_entry(&conn.lock().unwrap(), &final_entry).ok(); }
            app.emit("sync_entry_updated", &final_entry).ok();
        }
    }
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

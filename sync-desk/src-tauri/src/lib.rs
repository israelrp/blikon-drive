mod auth_cookies;
mod db;
mod models;
mod sync;
mod upload;

use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State, async_runtime};
use models::{AppConfig, SyncEntry, UserProfile};
use sync::SyncState;

type DbConn   = Arc<Mutex<rusqlite::Connection>>;
type AppState = Arc<Mutex<SyncState>>;

// Bridge script inyectado en la ventana de login.
// Corre en el contexto de validacel.com.blog → sin restricción CORS para
// llamar a api-authentication-v3.com.blog (mismo ecosistema).
//
// Para devolver el perfil a Rust sin depender de localhost POST
// ni de schemes custom, navegamos al mismo dominio con el payload en
// el query param __blikonauth. Rust intercepta con on_navigation
// ANTES de que el browser haga la petición real y retorna false
// para cancelarla — el servidor de ValidaCel nunca la recibe.
// Bridge script: detecta la página de éxito y señala a Rust con una navegación.
// window.location.href = 'tauri-auth://...' es interceptado por on_navigation en Rust
// a nivel de WKWebView — NO usa Tauri IPC (que está bloqueado para URLs externas).
// Rust lee las cookies directamente del WKHTTPCookieStore y llama a ValidaCel con reqwest.
const AUTH_BRIDGE_SCRIPT: &str = r#"
(function () {
  var signaled = false;
  // Nuestro API intermediario: lee cookies .com.blog, refresca el access_token
  // server-side si expiró, y devuelve el perfil. Navegamos aquí (no fetch) para
  // evitar CORS por completo — la navegación envía las cookies same-site.
  var ME_URL = 'https://api-blikondrive.com.blog/api/auth/me';

  // ── Caso 1: estamos en la página del API con el JSON del perfil ──
  if (window.location.href.indexOf(ME_URL) === 0) {
    var parsed = false;

    function tryParseProfile() {
      if (parsed) return;
      // WebView2 (Edge/Windows) renderiza JSON en un <pre>. WKWebView (macOS) en body.
      var pre = document.querySelector('pre');
      var raw = (pre ? pre.textContent : null)
             || (document.body && document.body.innerText)
             || '';
      var jsonStart = raw.indexOf('{');
      var jsonEnd   = raw.lastIndexOf('}');
      if (jsonStart < 0 || jsonEnd <= jsonStart) {
        // El JSON aún no está en el DOM — reintentamos luego
        return;
      }
      raw = raw.substring(jsonStart, jsonEnd + 1);

      try {
        var p = JSON.parse(raw);
        parsed = true;
        console.log('[BS] perfil obtenido, keys=' + Object.keys(p).join(','));

        // El API devuelve camelCase (blikonId, cronoCode, ...)
        var profile = {
          blikonId:    p.blikonId    || p.blikon_id    || '',
          cronoCode:   p.cronoCode   || p.crono_code   || '',
          profileName: p.profileName || p.profile_name || ((p.firstName || p.first_name || '') + ' ' + (p.lastName || p.last_name || '')).trim(),
          email:       p.email       || '',
          photo:       p.photo       || '',
          firstName:   p.firstName   || p.first_name   || '',
          lastName:    p.lastName    || p.last_name    || ''
        };
        console.log('[BS] perfil → blikonId=' + profile.blikonId + ' cronoCode=' + profile.cronoCode);
        window.location.href = 'tauri-auth://profile?d=' + encodeURIComponent(JSON.stringify(profile));
      } catch(e) {
        console.warn('[BS] JSON incompleto, reintentando:', e);
      }
    }

    // El script se inyecta antes de que el DOM esté listo — esperamos al contenido
    function waitForProfile(attempts) {
      if (parsed) return;
      tryParseProfile();
      if (!parsed && attempts < 30) {
        setTimeout(function() { waitForProfile(attempts + 1); }, 100);
      } else if (!parsed) {
        console.warn('[BS] timeout esperando JSON, fallback macOS');
        window.location.href = 'tauri-auth://get-profile';
      }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      waitForProfile(0);
    } else {
      document.addEventListener('DOMContentLoaded', function() { waitForProfile(0); });
      window.addEventListener('load', function() { waitForProfile(0); });
    }
    return;
  }

  // ── Caso 2: estamos en validacel.com.blog — detectar login exitoso ──
  function showBanner(msg, color) {
    var b = document.getElementById('__blikon_banner');
    if (!b) {
      b = document.createElement('div');
      b.id = '__blikon_banner';
      b.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:10px 16px;font-family:sans-serif;font-size:13px;z-index:99999;text-align:center;';
      document.body && document.body.appendChild(b);
    }
    b.style.background = color || '#1a73e8';
    b.style.color = '#fff';
    b.textContent = msg;
  }

  function isSuccessPage() {
    var t = (document.body && document.body.innerText) || '';
    var ok = t.includes('Sesión iniciada') || t.includes('identidad fue validada');
    console.log('[BS] isSuccessPage=' + ok + ' text=' + t.substring(0, 60).replace(/\n/g,' '));
    return ok;
  }

  function trySignal() {
    if (signaled) return;
    if (!isSuccessPage()) return;
    signaled = true;
    showBanner('Conectando con Blikon Sync…', '#1a73e8');
    console.log('[BS] navegando al API intermediario para obtener perfil');
    // Navegación directa — sin CORS. El API lee las cookies y refresca el token.
    window.location.href = ME_URL;
  }

  function setup() {
    setTimeout(trySignal, 800);
    setTimeout(trySignal, 2000);
    setTimeout(trySignal, 4000);

    var obs = new MutationObserver(function() { trySignal(); });
    obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
"#;

// ─── commands ────────────────────────────────────────────────────────────────

#[tauri::command]
fn get_config(state: State<AppState>) -> AppConfig {
    state.lock().unwrap().config.clone()
}

#[tauri::command]
fn get_entries(conn: State<DbConn>) -> Vec<SyncEntry> {
    db::load_entries(&conn.lock().unwrap()).unwrap_or_default()
}

#[tauri::command]
async fn save_config(
    config: AppConfig,
    state:  State<'_, AppState>,
    conn:   State<'_, DbConn>,
    app:    AppHandle,
) -> Result<(), String> {
    // Preservar identidad/perfil del config actual — SetupView no los reenvía
    let mut config = config;
    {
        let cur = state.lock().unwrap().config.clone();
        if config.blikon_id.is_empty()  { config.blikon_id  = cur.blikon_id; }
        if config.crono_code.is_empty() { config.crono_code = cur.crono_code; }
        if config.user_profile.is_none() { config.user_profile = cur.user_profile; }
    }

    { db::save_config(&conn.lock().unwrap(), &config).map_err(|e| e.to_string())?; }
    { let mut s = state.lock().unwrap(); s.config = config; s.watcher = None; }
    let s = Arc::clone(&state);
    let c = Arc::clone(&conn);
    sync::start_watcher(app.clone(), Arc::clone(&s), Arc::clone(&c));
    async_runtime::spawn(async move { sync::run_sync(app, s, c).await; });
    Ok(())
}

#[tauri::command]
async fn save_user_profile(
    profile: UserProfile,
    state:   State<'_, AppState>,
    conn:    State<'_, DbConn>,
) -> Result<(), String> {
    let mut config = { state.lock().unwrap().config.clone() };
    config.blikon_id    = profile.blikon_id.clone();
    config.crono_code   = profile.crono_code.clone();
    config.user_profile = Some(profile);
    { db::save_config(&conn.lock().unwrap(), &config).map_err(|e| e.to_string())?; }
    { state.lock().unwrap().config = config; }
    Ok(())
}

#[tauri::command]
async fn trigger_sync(
    state: State<'_, AppState>,
    conn:  State<'_, DbConn>,
    app:   AppHandle,
) -> Result<(), String> {
    let s = Arc::clone(&state);
    let c = Arc::clone(&conn);
    async_runtime::spawn(async move { sync::run_sync(app, s, c).await; });
    Ok(())
}

#[tauri::command]
fn pause_sync(state: State<AppState>) { state.lock().unwrap().paused = true; }

#[tauri::command]
fn resume_sync(state: State<AppState>) { state.lock().unwrap().paused = false; }

/// Cierra sesión: borra cronoCode + perfil del config SQLite y limpia cookies del WKWebView.
#[tauri::command]
async fn logout(
    state: State<'_, AppState>,
    conn:  State<'_, DbConn>,
) -> Result<(), String> {
    let mut config = { state.lock().unwrap().config.clone() };
    config.blikon_id    = String::new();
    config.crono_code   = String::new();
    config.user_profile = None;
    config.sync_folders = Vec::new();   // limpiar folders también

    { db::save_config(&conn.lock().unwrap(), &config).map_err(|e| e.to_string())?; }

    {
        let c = conn.lock().unwrap();
        db::clear_entries(&c).map_err(|e| e.to_string())?;
    }

    { state.lock().unwrap().config = config; }

    // Limpiar cookies del WKWebView para forzar login fresco la próxima vez
    #[cfg(target_os = "macos")]
    auth_cookies::clear_validacel_cookies().await;

    println!("[Auth] logout completado");
    Ok(())
}

/// Limpia solo el historial de sync (mantiene config y perfil).
#[tauri::command]
fn clear_sync_entries(conn: State<DbConn>) -> Result<usize, String> {
    let deleted = db::clear_entries(&conn.lock().unwrap()).map_err(|e| e.to_string())?;
    println!("[Sync] {deleted} entradas eliminadas de SQLite");
    Ok(deleted)
}

// Llamado por el bridge script cuando detecta la página de éxito.
// Lee las cookies del WKHTTPCookieStore (acceso nativo, sin CORS ni SameSite),
// llama a ValidaCel con reqwest y emite auth_success con el perfil.
#[tauri::command]
async fn get_profile_with_cookies(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let win = app.get_webview_window("login")
            .ok_or("ventana login no encontrada")?;
        let api_url = app.state::<AppState>().lock().unwrap().config.api_url.clone();
        let api_url = if api_url.is_empty() { "https://api-blikondrive.com.blog".to_string() } else { api_url };

        let profile = auth_cookies::get_validacel_profile(&win, &api_url).await?;

        let profile_json = serde_json::json!({
            "blikonId":    profile.blikon_id,
            "cronoCode":   profile.crono_code,
            "profileName": if profile.profile_name.is_empty() {
                format!("{} {}", profile.first_name, profile.last_name).trim().to_string()
            } else { profile.profile_name },
            "email":       profile.email,
            "photo":       profile.photo,
            "firstName":   profile.first_name,
            "lastName":    profile.last_name,
        });

        println!("[Rust] auth_success → {}", profile_json);
        app.emit("auth_success", profile_json.to_string()).ok();
        win.close().ok();
        return Ok(());
    }

    Err("solo disponible en macOS".into())
}

// Fallback: el bridge script puede pasar el perfil directamente si lo obtuvo por otro medio
#[tauri::command]
fn receive_profile(profile_json: String, app: AppHandle) {
    println!("[Rust] receive_profile fallback");
    app.emit("auth_success", &profile_json).ok();
    if let Some(w) = app.get_webview_window("login") {
        w.close().ok();
    }
}

#[tauri::command]
async fn open_login_window(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("login") {
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Limpiar cookies ValidaCel antes de abrir para forzar login fresco
    #[cfg(target_os = "macos")]
    auth_cookies::clear_validacel_cookies().await;

    let app_nav   = app.clone();
    let app_close = app.clone();

    tauri::WebviewWindowBuilder::new(
        &app,
        "login",
        tauri::WebviewUrl::External("https://validacel.com.blog".parse().unwrap()),
    )
    .title("Iniciar sesión — ValidaCel")
    .inner_size(480.0, 640.0)
    .center()
    .initialization_script(AUTH_BRIDGE_SCRIPT)
    // on_navigation intercepta la navegación a "tauri-auth://" del bridge script.
    // Esto ocurre en WKNavigationDelegate ANTES de que el request salga al network.
    // No usa Tauri IPC — es un mecanismo de WKWebView puro.
    .on_navigation(move |url| {
        println!("[Rust] on_navigation: {}", url);
        if url.scheme() == "tauri-auth" {
            println!("[Rust] on_navigation intercepted: {}", url);

            // Cross-platform: perfil en query param d= (bridge script lo obtiene por JS)
            if url.host_str() == Some("profile") {
                for (key, value) in url.query_pairs() {
                    if key == "d" {
                        let profile_str = value.into_owned();
                        let app2 = app_nav.clone();
                        async_runtime::spawn(async move {
                            println!("[Rust] auth_success via URL profile");
                            app2.emit("auth_success", &profile_str).ok();
                            if let Some(win) = app2.get_webview_window("login") {
                                win.close().ok();
                            }
                        });
                        break;
                    }
                }
                return false;
            }

            // Fallback macOS: lectura directa de cookies WKWebView
            #[cfg(target_os = "macos")]
            if url.host_str() == Some("get-profile") {
                let app2 = app_nav.clone();
                async_runtime::spawn(async move {
                    if let Some(win) = app2.get_webview_window("login") {
                        let api_url2 = app2.state::<AppState>().lock().unwrap().config.api_url.clone();
                        let api_url2 = if api_url2.is_empty() { "https://api-blikondrive.com.blog".to_string() } else { api_url2 };
                        match auth_cookies::get_validacel_profile(&win, &api_url2).await {
                            Ok(p) => {
                                let json = serde_json::json!({
                                    "blikonId":    p.blikon_id,
                                    "cronoCode":   p.crono_code,
                                    "profileName": if p.profile_name.is_empty() {
                                        format!("{} {}", p.first_name, p.last_name).trim().to_string()
                                    } else { p.profile_name },
                                    "email":     p.email,
                                    "photo":     p.photo,
                                    "firstName": p.first_name,
                                    "lastName":  p.last_name,
                                });
                                println!("[Rust] auth_success via cookies → {json}");
                                app2.emit("auth_success", json.to_string()).ok();
                                win.close().ok();
                            }
                            Err(e) => {
                                eprintln!("[Rust] get_validacel_profile error: {e}");
                                app2.emit("auth_error", &e).ok();
                            }
                        }
                    }
                });
            }

            return false;
        }
        true
    })
    .build()
    .map_err(|e| e.to_string())?
    .on_window_event(move |event| {
        if matches!(event, tauri::WindowEvent::Destroyed) {
            app_close.emit("login_window_closed", ()).ok();
        }
    });

    Ok(())
}

/// Abre DevTools de la ventana de login para diagnóstico.
#[tauri::command]
fn open_login_devtools(app: AppHandle) {
    if let Some(win) = app.get_webview_window("login") {
        win.open_devtools();
    }
}

/// Obtiene los folders raíz del usuario desde la API (sin CORS — llamada Rust nativa).
#[tauri::command]
async fn get_remote_folders(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let config = state.lock().unwrap().config.clone();
    if config.blikon_id.is_empty() {
        return Ok(vec![]);
    }
    let api_url = if config.api_url.is_empty() {
        "https://api-blikondrive.com.blog".to_string()
    } else {
        config.api_url.clone()
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(format!("{api_url}/api/folders"))
        .header("X-Blikon-Id", &config.blikon_id)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Ok(vec![]);
    }

    let folders: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let ids = folders.as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|f| f["id"].as_str().map(|s| s.to_string()))
        .collect();

    Ok(ids)
}

// ─── setup ───────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir().unwrap();
            std::fs::create_dir_all(&data_dir).unwrap();
            let conn   = db::open(&data_dir).expect("DB");
            let config = db::load_config(&conn).unwrap_or_default();
            let conn   = Arc::new(Mutex::new(conn));
            let sync_state = Arc::new(Mutex::new(SyncState {
                config: config.clone(), paused: false, watcher: None, syncing: false,
            }));
            app.manage(conn.clone());
            app.manage(sync_state.clone());
            if !config.sync_folders.is_empty() {
                let app2   = app.handle().clone();
                let state2 = Arc::clone(&sync_state);
                let conn2  = Arc::clone(&conn);
                sync::start_watcher(app.handle().clone(), Arc::clone(&sync_state), Arc::clone(&conn));
                async_runtime::spawn(async move { sync::run_sync(app2, state2, conn2).await; });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config, get_entries, save_config, save_user_profile,
            trigger_sync, pause_sync, resume_sync,
            logout, clear_sync_entries,
            get_profile_with_cookies, receive_profile, open_login_window,
            get_remote_folders, open_login_devtools,
        ])
        .run(tauri::generate_context!())
        .expect("error running app");
}

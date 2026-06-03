use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;

pub struct ValidacelProfile {
    pub blikon_id:    String,
    pub crono_code:   String,
    pub profile_name: String,
    pub email:        String,
    pub photo:        String,
    pub first_name:   String,
    pub last_name:    String,
}

#[cfg(target_os = "macos")]
pub async fn get_validacel_profile(
    win:     &tauri::WebviewWindow<tauri::Wry>,
    api_url: &str,                   // URL base de BlikonDrive API (ej: http://localhost:5086)
) -> Result<ValidacelProfile, String> {
    // 1. Extraer cookies del WKHTTPCookieStore (acceso nativo, sin restricciones JS)
    let cookies = extract_cookies(win).await?;
    println!("[Auth] cookies extraídas: access={} refresh={}",
        cookies.access_token.len(), cookies.refresh_token.len());

    if cookies.access_token.is_empty() {
        return Err("access_token no encontrado en WKWebView".into());
    }

    // 2. Llamar a nuestra propia API como proxy (sin CORS, sin SameSite)
    //    La API .NET llama a ValidaCel server-side con las cookies como header.
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "accessToken":  cookies.access_token,
        "refreshToken": cookies.refresh_token,
    });

    let resp = client
        .post(format!("{api_url}/api/auth/check"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("proxy auth check: {e}"))?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    println!("[Auth] proxy /api/auth/check → status={status} body={text}");

    if !status.is_success() {
        return Err(format!("auth check falló ({status}): {text}"));
    }

    let p: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("parse profile: {e}"))?;

    let blikon_id = p["blikonId"].as_str().unwrap_or("").to_string();
    if blikon_id.is_empty() {
        return Err(format!("blikonId vacío en respuesta: {p}"));
    }

    Ok(ValidacelProfile {
        blikon_id,
        crono_code: p["cronoCode"].as_str().unwrap_or("").to_string(),
        profile_name: p["profileName"].as_str().unwrap_or("").to_string(),
        email:        p["email"].as_str().unwrap_or("").to_string(),
        photo:        p["photo"].as_str().unwrap_or("").to_string(),
        first_name:   p["firstName"].as_str().unwrap_or("").to_string(),
        last_name:    p["lastName"].as_str().unwrap_or("").to_string(),
    })
}

struct CookiePair {
    access_token:  String,
    refresh_token: String,
}

#[cfg(target_os = "macos")]
async fn extract_cookies(
    win: &tauri::WebviewWindow<tauri::Wry>,
) -> Result<CookiePair, String> {
    use objc2::runtime::AnyObject;
    use objc2::msg_send;
    use objc2_foundation::{NSArray, NSHTTPCookie, NSString};
    use objc2_web_kit::{WKWebView, WKWebViewConfiguration, WKWebsiteDataStore, WKHTTPCookieStore};
    use block2::RcBlock;

    let (tx, rx) = oneshot::channel::<CookiePair>();
    let tx = Arc::new(Mutex::new(Some(tx)));

    win.with_webview(move |wv| {
        let tx = Arc::clone(&tx);
        unsafe {
            let webview = wv.inner() as *mut WKWebView;
            let config: *mut WKWebViewConfiguration = msg_send![webview, configuration];
            let data_store: *mut WKWebsiteDataStore = msg_send![config, websiteDataStore];
            let cookie_store: *mut WKHTTPCookieStore = msg_send![data_store, httpCookieStore];

            let block = RcBlock::new(move |cookies: *mut NSArray<NSHTTPCookie>| {
                let mut access  = String::new();
                let mut refresh = String::new();

                if !cookies.is_null() {
                    let count: usize = unsafe { (*cookies).count() };
                    for i in 0..count {
                        unsafe {
                            let cookie: *mut NSHTTPCookie = msg_send![cookies, objectAtIndex: i];
                            let name:   *mut NSString     = msg_send![cookie, name];
                            let value:  *mut NSString     = msg_send![cookie, value];
                            let domain: *mut NSString     = msg_send![cookie, domain];

                            let name_s   = (*name).to_string();
                            let value_s  = (*value).to_string();
                            let domain_s = (*domain).to_string();

                            println!("[Cookies] {} ({}c) domain={}", name_s, value_s.len(), domain_s);

                            if domain_s.ends_with(".com.blog") || domain_s == "com.blog" {
                                match name_s.as_str() {
                                    "access_token"  => access  = value_s,
                                    "refresh_token" => refresh = value_s,
                                    _ => {}
                                }
                            }
                        }
                    }
                }

                if let Some(sender) = tx.lock().unwrap().take() {
                    let _ = sender.send(CookiePair { access_token: access, refresh_token: refresh });
                }
            });

            let _: () = msg_send![cookie_store, getAllCookies: &*block];
        }
    }).map_err(|e| e.to_string())?;

    tokio::time::timeout(std::time::Duration::from_secs(5), rx)
        .await
        .map_err(|_| "timeout")?
        .map_err(|_| "channel cerrado".to_string())
}

/// Elimina todas las cookies de dominio *.com.blog del WKWebsiteDataStore por defecto.
/// Se llama antes de abrir la ventana de login para forzar un login fresco cada vez.
#[cfg(target_os = "macos")]
pub async fn clear_validacel_cookies() {
    use objc2::runtime::AnyObject;
    use objc2::{msg_send, ClassType};
    use objc2_foundation::{NSArray, NSHTTPCookie, NSString};
    use objc2_web_kit::{WKWebsiteDataStore, WKHTTPCookieStore};
    use block2::RcBlock;

    let (tx, rx) = oneshot::channel::<()>();
    let tx = Arc::new(Mutex::new(Some(tx)));

    unsafe {
        let data_store: *mut WKWebsiteDataStore = msg_send![WKWebsiteDataStore::class(), defaultDataStore];
        let cookie_store: *mut WKHTTPCookieStore = msg_send![data_store, httpCookieStore];

        let block = RcBlock::new(move |cookies: *mut NSArray<NSHTTPCookie>| {
            if !cookies.is_null() {
                let count: usize = unsafe { (*cookies).count() };
                for i in 0..count {
                    unsafe {
                        let cookie: *mut NSHTTPCookie = msg_send![cookies, objectAtIndex: i];
                        let domain: *mut NSString = msg_send![cookie, domain];
                        let domain_s = (*domain).to_string();
                        if domain_s.ends_with(".com.blog") || domain_s == "com.blog"
                            || domain_s.contains("validacel")
                        {
                            let name: *mut NSString = msg_send![cookie, name];
                            println!("[Cookies] clearing {} domain={}", (*name).to_string(), domain_s);
                            let _: () = msg_send![cookie_store, deleteCookie: cookie
                                                  completionHandler: std::ptr::null::<AnyObject>()];
                        }
                    }
                }
            }
            if let Some(s) = tx.lock().unwrap().take() { let _ = s.send(()); }
        });

        let _: () = msg_send![cookie_store, getAllCookies: &*block];
    }

    let _ = tokio::time::timeout(std::time::Duration::from_secs(3), rx).await;
    println!("[Auth] cookies ValidaCel limpiadas");
}

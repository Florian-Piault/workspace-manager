use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Runtime, WebviewUrl};
use tauri::webview::WebviewBuilder;

fn get_webview<R: Runtime>(app: &AppHandle<R>, id: &str) -> Result<tauri::Webview<R>, String> {
    app.get_webview(id).ok_or_else(|| format!("webview '{id}' not found"))
}

#[tauri::command]
pub fn browser_open<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    url: String,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
) -> Result<(), String> {
    let parsed: url::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;
    let window = app.get_window("main").ok_or("no main window")?;

    let app_nav = app.clone();
    let id_nav = id.clone();
    let id_script = id.clone();

    let init_script = format!(
        r#"(function(){{
            var __id="{}";
            function report(){{
                try{{window.__TAURI_INTERNALS__.invoke("browser_report_title",{{id:__id,title:document.title}});}}catch(e){{}}
            }}
            if(document.readyState!=="loading"){{report();}}
            else{{document.addEventListener("DOMContentLoaded",report);}}
            new MutationObserver(report).observe(document.documentElement,{{subtree:true,childList:true}});
        }})();"#,
        id_script
    );

    window
        .add_child(
            WebviewBuilder::new(&id, WebviewUrl::External(parsed))
                .initialization_script(&init_script)
                .on_navigation(move |nav_url: &url::Url| {
                    let _ = app_nav.emit(&format!("browser_url:{}", id_nav), nav_url.to_string());
                    true
                }),
            LogicalPosition::new(x, y),
            LogicalSize::new(w, h),
        )
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn browser_navigate<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    url: String,
) -> Result<(), String> {
    let parsed: url::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;
    get_webview(&app, &id)?.navigate(parsed).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn browser_resize<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
) -> Result<(), String> {
    let wv = get_webview(&app, &id)?;
    wv.set_position(LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    wv.set_size(LogicalSize::new(w, h))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn browser_close<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    get_webview(&app, &id)?.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn browser_back<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    get_webview(&app, &id)?.eval("history.back()").map_err(|e| e.to_string())
}

#[tauri::command]
pub fn browser_forward<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    get_webview(&app, &id)?.eval("history.forward()").map_err(|e| e.to_string())
}

#[tauri::command]
pub fn browser_refresh<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    get_webview(&app, &id)?.eval("location.reload()").map_err(|e| e.to_string())
}

#[tauri::command]
pub fn browser_report_title<R: Runtime>(app: AppHandle<R>, id: String, title: String) {
    let _ = app.emit(&format!("browser_title:{}", id), title);
}

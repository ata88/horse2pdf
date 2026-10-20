//! Native shell of horse2pdf.
//!
//! All invoice logic lives in the web frontend (TypeScript). This crate only provides
//! what a webview cannot do on its own: reading/writing files chosen by the user,
//! native printing, and receiving files from the OS ("Open with…", file associations,
//! a second app start).

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};

/// Files handed to the app before the frontend was ready to receive them.
#[derive(Default)]
struct PendingFiles {
    files: Mutex<Vec<String>>,
    frontend_ready: AtomicBool,
}

const MAX_FILE_SIZE: u64 = 200 * 1024 * 1024;

/// Reads a file and returns its raw bytes (binary IPC response, no JSON overhead).
#[tauri::command]
fn read_file(path: String) -> Result<Response, String> {
    let meta = std::fs::metadata(&path).map_err(|e| format!("{path}: {e}"))?;
    if !meta.is_file() {
        return Err(format!("{path}: keine Datei"));
    }
    if meta.len() > MAX_FILE_SIZE {
        return Err(format!("{path}: Datei ist zu groß"));
    }
    std::fs::read(&path)
        .map(Response::new)
        .map_err(|e| format!("{path}: {e}"))
}

/// Writes the raw request body to the path given in the (URL encoded) `path` header.
/// The path always comes from a native save dialog in the frontend.
#[tauri::command]
fn write_file(request: Request<'_>) -> Result<(), String> {
    let header = request
        .headers()
        .get("path")
        .and_then(|v| v.to_str().ok())
        .ok_or("Zielpfad fehlt")?;
    let path = urlencoding::decode(header)
        .map_err(|e| e.to_string())?
        .into_owned();
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("Binärdaten erwartet".into());
    };
    std::fs::write(&path, bytes).map_err(|e| format!("{path}: {e}"))
}

/// Opens the native print dialog for the current webview.
#[tauri::command]
fn print_window(window: WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

/// Returns (once) the files the app was started with.
#[tauri::command]
fn take_pending_files(state: State<'_, PendingFiles>) -> Vec<String> {
    state.frontend_ready.store(true, Ordering::SeqCst);
    std::mem::take(&mut *state.files.lock().unwrap())
}

/// Keeps only arguments that point to existing files (skips flags and the binary itself).
fn file_args<I: IntoIterator<Item = String>>(args: I, cwd: Option<&str>) -> Vec<String> {
    args.into_iter()
        .filter(|a| !a.starts_with('-'))
        .filter_map(|a| {
            let p = PathBuf::from(&a);
            let p = match (p.is_absolute(), cwd) {
                (false, Some(dir)) => PathBuf::from(dir).join(p),
                _ => p,
            };
            p.is_file().then(|| p.to_string_lossy().into_owned())
        })
        .collect()
}

/// Delivers files to the frontend now, or queues them until it asks for them.
fn deliver_files(app: &AppHandle, files: Vec<String>) {
    if files.is_empty() {
        return;
    }
    let state = app.state::<PendingFiles>();
    if state.frontend_ready.load(Ordering::SeqCst) {
        let _ = app.emit("open-files", files);
    } else {
        state.files.lock().unwrap().extend(files);
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
    {
        // A second start (e.g. double click on another invoice) opens the file in the
        // already running window instead of launching a new instance.
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            let files = file_args(argv.into_iter().skip(1), Some(&cwd));
            deliver_files(app, files);
        }));
    }

    let app = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(PendingFiles::default())
        .setup(|app| {
            // Windows / Linux pass files as command line arguments.
            let files = file_args(std::env::args().skip(1), None);
            app.state::<PendingFiles>()
                .files
                .lock()
                .unwrap()
                .extend(files);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            print_window,
            take_pending_files
        ])
        .build(tauri::generate_context!())
        .expect("error while building the horse2pdf application");

    app.run(|_app, _event| {
        // macOS delivers "Open with…" / double clicked files as an event.
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        if let tauri::RunEvent::Opened { urls } = _event {
            let files = urls
                .into_iter()
                .filter_map(|u| u.to_file_path().ok())
                .map(|p| p.to_string_lossy().into_owned())
                .collect();
            deliver_files(_app, files);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::file_args;

    #[test]
    fn file_args_keeps_only_existing_files() {
        let dir = std::env::temp_dir();
        let file = dir.join("horse2pdf-test-invoice.xml");
        std::fs::write(&file, "<x/>").unwrap();
        let args = vec![
            "--flag".to_string(),
            file.to_string_lossy().into_owned(),
            "does-not-exist.xml".to_string(),
        ];
        assert_eq!(
            file_args(args, None),
            vec![file.to_string_lossy().into_owned()]
        );
        let relative = file_args(
            vec!["horse2pdf-test-invoice.xml".to_string()],
            Some(&dir.to_string_lossy()),
        );
        assert_eq!(relative.len(), 1);
        std::fs::remove_file(file).unwrap();
    }
}

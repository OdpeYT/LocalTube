use serde::Serialize;
use std::{env, fs, path::Path};

#[derive(Serialize)]
pub struct VideoMetadata {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub modified_at: String,
}

#[tauri::command]
fn default_video_directory() -> Result<String, String> {
    let home = env::var_os("HOME")
        .map(std::path::PathBuf::from)
        .ok_or_else(|| "No se pudo determinar tu carpeta de usuario.".to_string())?;

    for folder in ["Videos", "Descargas", "Downloads"] {
        let candidate = home.join(folder);
        if candidate.is_dir() {
            return Ok(candidate.to_string_lossy().into_owned());
        }
    }

    Ok(home.to_string_lossy().into_owned())
}

#[tauri::command]
fn scan_local_storage(folder_path: String) -> Result<Vec<VideoMetadata>, String> {
    let path = Path::new(&folder_path);
    if !path.is_dir() {
        return Err(format!("La carpeta no existe o no es válida: {folder_path}"));
    }

    let entries = fs::read_dir(path).map_err(|error| {
        format!("No se pudo leer la carpeta {folder_path}: {error}")
    })?;
    let mut videos = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|error| format!("No se pudo leer un archivo: {error}"))?;
        let file_path = entry.path();
        if !entry
            .file_type()
            .map_err(|error| format!("No se pudo revisar un archivo: {error}"))?
            .is_file()
        {
            continue;
        }

        let is_video = file_path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| {
                ["mp4", "mkv", "webm", "mov"]
                    .contains(&extension.to_ascii_lowercase().as_str())
            });
        if !is_video {
            continue;
        }

        let metadata = fs::metadata(&file_path)
            .map_err(|error| format!("No se pudo leer {}: {error}", file_path.display()))?;
        let modified_at = metadata
            .modified()
            .map(|time| {
                let datetime: chrono::DateTime<chrono::Local> = time.into();
                datetime.format("%d/%m/%Y %H:%M").to_string()
            })
            .unwrap_or_else(|_| "Desconocida".to_string());

        videos.push(VideoMetadata {
            name: entry.file_name().to_string_lossy().into_owned(),
            path: file_path
                .canonicalize()
                .unwrap_or(file_path)
                .to_string_lossy()
                .into_owned(),
            size_bytes: metadata.len(),
            modified_at,
        });
    }

    videos.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Ok(videos)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            default_video_directory,
            scan_local_storage
        ])
        .run(tauri::generate_context!())
        .expect("Error al iniciar LocalTube");
}

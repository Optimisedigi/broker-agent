use tauri::State;

use crate::db::{AppState, Document};

#[tauri::command]
pub fn get_client_documents(state: State<AppState>, client_id: i64) -> Result<Vec<Document>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, client_id, filename, document_type, file_path, source, uploaded_at FROM documents WHERE client_id = ?1 ORDER BY uploaded_at DESC")
        .map_err(|e| e.to_string())?;

    let docs = stmt
        .query_map([&client_id], |row| {
            Ok(Document {
                id: row.get(0)?,
                client_id: row.get(1)?,
                filename: row.get(2)?,
                document_type: row.get(3)?,
                file_path: row.get(4)?,
                file_data: None,
                source: row.get(5)?,
                uploaded_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(docs)
}

#[tauri::command]
pub fn upload_client_document(
    state: State<AppState>,
    client_id: i64,
    filename: String,
    document_type: String,
    file_path: String,
    file_data: Option<String>,
) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Local::now().to_rfc3339();

    conn.execute(
        "INSERT INTO documents (client_id, filename, document_type, file_path, file_data, uploaded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        [
            &client_id.to_string(),
            &filename,
            &document_type,
            &file_path,
            &file_data.unwrap_or_default(),
            &now,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn get_document_data(state: State<AppState>, document_id: i64) -> Result<Option<String>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let result = conn.query_row(
        "SELECT file_data FROM documents WHERE id = ?1",
        [&document_id],
        |row| row.get::<_, Option<String>>(0),
    );

    match result {
        Ok(data) => Ok(data),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn rename_document(state: State<AppState>, document_id: i64, new_name: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE documents SET filename = ?1 WHERE id = ?2",
        rusqlite::params![new_name, document_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_document(state: State<AppState>, document_id: i64) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let file_path: Option<String> = conn
        .query_row("SELECT file_path FROM documents WHERE id = ?1", [document_id], |row| row.get(0))
        .ok();
    conn.execute("DELETE FROM documents WHERE id = ?1", [document_id])
        .map_err(|e| e.to_string())?;
    if let Some(path) = file_path {
        let _ = std::fs::remove_file(&path);
    }
    Ok(())
}

#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
    if !std::path::Path::new(&path).exists() {
        return Err("File not found on disk".to_string());
    }
    open::that(&path).map_err(|e| format!("Failed to open file: {}", e))
}

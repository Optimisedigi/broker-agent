use tauri::State;

use crate::db::{do_import_email_document, AppState, EmailImport};

#[tauri::command]
pub fn import_email_document(
    state: State<AppState>,
    sender_email: String,
    subject: String,
    document_path: String,
) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    do_import_email_document(&conn, &sender_email, &subject, &document_path)
}

#[tauri::command]
pub fn get_recent_email_imports(state: State<AppState>, limit: i64) -> Result<Vec<EmailImport>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, client_id, sender_email, subject, document_path, imported_at, processed
                 FROM email_imports
                 ORDER BY imported_at DESC
                 LIMIT ?1")
        .map_err(|e| e.to_string())?;

    let imports = stmt
        .query_map([&limit.to_string()], |row| {
            Ok(EmailImport {
                id: row.get(0)?,
                client_id: row.get(1)?,
                sender_email: row.get(2)?,
                subject: row.get(3)?,
                document_path: row.get(4)?,
                imported_at: row.get(5)?,
                processed: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(imports)
}

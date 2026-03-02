use tauri::State;

use crate::db::{AppState, Meeting};

#[tauri::command]
pub fn save_meeting(state: State<AppState>, meeting: Meeting) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    // First, check if client exists by email
    let client_id: Option<i64> = conn
        .query_row(
            "SELECT id FROM clients WHERE email = ?1",
            [&meeting.client_email],
            |row| row.get(0),
        )
        .ok();

    let client_id = match client_id {
        Some(id) => id,
        None => {
            // Create new client from meeting info
            let now = chrono::Local::now().to_rfc3339();
            let names: Vec<&str> = meeting.client_name.split_whitespace().collect();
            let first_name = names.first().unwrap_or(&"").to_string();
            let last_name = names.get(1..).unwrap_or(&[]).join(" ");

            conn.execute(
                "INSERT INTO clients (first_name, last_name, email, phone, income, payg, assets, liabilities, notes, home_address, investment_addresses, properties_viewing, available_deposit, monthly_expenses, goals, client_status, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, NULL, NULL, NULL, ?13, ?14, ?15)",
                rusqlite::params![
                    first_name,
                    last_name,
                    meeting.client_email,
                    "",
                    "",
                    "",
                    "",
                    "",
                    "Auto-created from meeting recording",
                    "",
                    "",
                    "",
                    "new",
                    now,
                    now,
                ],
            )
            .map_err(|e| e.to_string())?;

            conn.last_insert_rowid()
        }
    };

    // Insert the meeting
    let now = chrono::Local::now().to_rfc3339();
    conn.execute(
        "INSERT INTO meetings (client_id, title, recording_path, transcript, summary, meeting_date, duration_seconds, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        [
            &client_id.to_string(),
            &format!("Meeting with {}", meeting.client_name),
            &meeting.recording_path.unwrap_or_default(),
            &meeting.transcript.unwrap_or_default(),
            &meeting.summary.unwrap_or_default(),
            &now,
            &meeting.duration_seconds.map(|v| v.to_string()).unwrap_or_default(),
            &meeting.notes.unwrap_or_default(),
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn get_meetings(state: State<AppState>) -> Result<Vec<Meeting>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT m.id, m.client_id, c.first_name || ' ' || c.last_name as client_name, c.email, m.title, m.recording_path, m.transcript, m.summary, m.meeting_date, m.duration_seconds, m.notes
                 FROM meetings m
                 JOIN clients c ON m.client_id = c.id
                 ORDER BY m.meeting_date DESC")
        .map_err(|e| e.to_string())?;

    let meetings = stmt
        .query_map([], |row| {
            Ok(Meeting {
                id: row.get(0)?,
                client_id: row.get(1)?,
                client_name: row.get(2)?,
                client_email: row.get(3)?,
                title: row.get(4)?,
                recording_path: row.get(5)?,
                transcript: row.get(6)?,
                summary: row.get(7)?,
                meeting_date: row.get(8)?,
                duration_seconds: row.get(9)?,
                notes: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(meetings)
}

#[tauri::command]
pub fn get_client_meetings(state: State<AppState>, client_id: i64) -> Result<Vec<Meeting>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT m.id, m.client_id, c.first_name || ' ' || c.last_name as client_name, c.email, m.title, m.recording_path, m.transcript, m.summary, m.meeting_date, m.duration_seconds, m.notes
                 FROM meetings m
                 JOIN clients c ON m.client_id = c.id
                 WHERE m.client_id = ?1
                 ORDER BY m.meeting_date DESC")
        .map_err(|e| e.to_string())?;

    let meetings = stmt
        .query_map([&client_id], |row| {
            Ok(Meeting {
                id: row.get(0)?,
                client_id: row.get(1)?,
                client_name: row.get(2)?,
                client_email: row.get(3)?,
                title: row.get(4)?,
                recording_path: row.get(5)?,
                transcript: row.get(6)?,
                summary: row.get(7)?,
                meeting_date: row.get(8)?,
                duration_seconds: row.get(9)?,
                notes: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(meetings)
}

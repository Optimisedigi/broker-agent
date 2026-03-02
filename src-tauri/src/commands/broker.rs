use tauri::State;

use crate::db::{AppState, BrokerProfile};

#[tauri::command]
pub fn get_broker_profile(state: State<AppState>) -> Result<Option<BrokerProfile>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let result = conn.query_row(
        "SELECT id, name, email, phone, role, photo, created_at, updated_at FROM broker_profile LIMIT 1",
        [],
        |row| {
            Ok(BrokerProfile {
                id: row.get(0)?,
                name: row.get(1)?,
                email: row.get(2)?,
                phone: row.get(3)?,
                role: row.get(4)?,
                photo: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        },
    );

    match result {
        Ok(profile) => Ok(Some(profile)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn save_broker_profile(state: State<AppState>, profile: BrokerProfile) -> Result<BrokerProfile, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Local::now().to_rfc3339();

    let existing_id: Option<i64> = conn
        .query_row("SELECT id FROM broker_profile LIMIT 1", [], |row| row.get(0))
        .ok();

    let id = match existing_id {
        Some(id) => {
            conn.execute(
                "UPDATE broker_profile SET name = ?1, email = ?2, phone = ?3, role = ?4, photo = ?5, updated_at = ?6 WHERE id = ?7",
                [
                    &profile.name,
                    &profile.email,
                    &profile.phone,
                    &profile.role,
                    &profile.photo.clone().unwrap_or_default(),
                    &now,
                    &id.to_string(),
                ],
            )
            .map_err(|e| e.to_string())?;
            id
        }
        None => {
            conn.execute(
                "INSERT INTO broker_profile (name, email, phone, role, photo, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                [
                    &profile.name,
                    &profile.email,
                    &profile.phone,
                    &profile.role,
                    &profile.photo.clone().unwrap_or_default(),
                    &now,
                    &now,
                ],
            )
            .map_err(|e| e.to_string())?;
            conn.last_insert_rowid()
        }
    };

    Ok(BrokerProfile {
        id: Some(id),
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        role: profile.role,
        photo: profile.photo,
        created_at: now.clone(),
        updated_at: now,
    })
}

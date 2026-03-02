use tauri::State;

use crate::db::{AppState, Deal, DealEvent};

#[tauri::command]
pub fn get_client_deals(state: State<AppState>, client_id: i64) -> Result<Vec<Deal>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, client_id, property_address, loan_amount, purchase_date, settlement_date, interest_rate, lender_name, loan_type, status, notes, created_at, updated_at FROM deals WHERE client_id = ?1 ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let deals = stmt
        .query_map([client_id], |row| {
            Ok(Deal {
                id: row.get(0)?,
                client_id: row.get(1)?,
                property_address: row.get(2)?,
                loan_amount: row.get(3)?,
                purchase_date: row.get(4)?,
                settlement_date: row.get(5)?,
                interest_rate: row.get(6)?,
                lender_name: row.get(7)?,
                loan_type: row.get(8)?,
                status: row.get(9)?,
                notes: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(deals)
}

#[tauri::command]
pub fn create_deal(state: State<AppState>, deal: Deal) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Local::now().to_rfc3339();

    conn.execute(
        "INSERT INTO deals (client_id, property_address, loan_amount, purchase_date, settlement_date, interest_rate, lender_name, loan_type, status, notes, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        rusqlite::params![
            deal.client_id,
            deal.property_address,
            deal.loan_amount,
            deal.purchase_date,
            deal.settlement_date,
            deal.interest_rate,
            deal.lender_name,
            deal.loan_type,
            deal.status,
            deal.notes,
            now,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn get_deal_events(state: State<AppState>, deal_id: i64) -> Result<Vec<DealEvent>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, deal_id, event_type, event_date, description, old_value, new_value, created_at FROM deal_events WHERE deal_id = ?1 ORDER BY event_date DESC")
        .map_err(|e| e.to_string())?;

    let events = stmt
        .query_map([deal_id], |row| {
            Ok(DealEvent {
                id: row.get(0)?,
                deal_id: row.get(1)?,
                event_type: row.get(2)?,
                event_date: row.get(3)?,
                description: row.get(4)?,
                old_value: row.get(5)?,
                new_value: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(events)
}

#[tauri::command]
pub fn create_deal_event(state: State<AppState>, event: DealEvent) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Local::now().to_rfc3339();

    conn.execute(
        "INSERT INTO deal_events (deal_id, event_type, event_date, description, old_value, new_value, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            event.deal_id,
            event.event_type,
            event.event_date,
            event.description,
            event.old_value,
            event.new_value,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

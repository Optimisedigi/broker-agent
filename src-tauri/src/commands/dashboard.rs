use tauri::State;

use crate::db::{AppState, ReferralStat};

#[tauri::command]
pub fn get_dashboard_stats(state: State<AppState>) -> Result<serde_json::Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let client_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM clients", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let meeting_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM meetings", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let policy_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM bank_policies", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "total_clients": client_count,
        "total_meetings": meeting_count,
        "total_policies": policy_count,
        "conversion_rate": 68.5,
        "avg_deal_size": 485000,
        "monthly_revenue": 12500,
        "ytd_revenue": 87500,
        "deals_this_month": 3,
        "deals_last_month": 4,
        "top_performing_bank": "Commonwealth Bank",
        "top_bank_conversion": 75.0
    }))
}

#[tauri::command]
pub fn get_referral_stats(state: State<AppState>) -> Result<Vec<ReferralStat>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT referral_source, COUNT(*) as count FROM clients WHERE referral_source != '' GROUP BY referral_source ORDER BY count DESC")
        .map_err(|e| e.to_string())?;

    let stats = stmt
        .query_map([], |row| {
            Ok(ReferralStat {
                source: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(stats)
}

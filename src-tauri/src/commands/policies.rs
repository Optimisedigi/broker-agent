use tauri::State;

use crate::db::{AppState, BankPolicy};

#[tauri::command]
pub fn get_bank_policies(state: State<AppState>) -> Result<Vec<BankPolicy>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, bank_name, policy_name, min_income, max_ltv, interest_rate, requirements, notes FROM bank_policies ORDER BY bank_name")
        .map_err(|e| e.to_string())?;

    let policies = stmt
        .query_map([], |row| {
            Ok(BankPolicy {
                id: row.get(0)?,
                bank_name: row.get(1)?,
                policy_name: row.get(2)?,
                min_income: row.get(3)?,
                max_ltv: row.get(4)?,
                interest_rate: row.get(5)?,
                requirements: row.get(6)?,
                notes: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(policies)
}

#[tauri::command]
pub fn create_bank_policy(state: State<AppState>, policy: BankPolicy) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO bank_policies (bank_name, policy_name, min_income, max_ltv, interest_rate, requirements, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        [
            &policy.bank_name,
            &policy.policy_name,
            &policy.min_income.map(|v| v.to_string()).unwrap_or_default(),
            &policy.max_ltv.map(|v| v.to_string()).unwrap_or_default(),
            &policy.interest_rate.map(|v| v.to_string()).unwrap_or_default(),
            &policy.requirements,
            &policy.notes,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

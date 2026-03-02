use tauri::State;

use crate::db::{get_opt_f64, AppState, Client};

#[tauri::command]
pub fn get_clients(state: State<AppState>) -> Result<Vec<Client>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, first_name, last_name, email, phone, income, payg, assets, liabilities, notes, home_address, investment_addresses, properties_viewing, available_deposit, monthly_expenses, goals, home_ownership, client_status, referral_source, pipeline_stage, current_lender, current_loan_balance, current_interest_rate, current_loan_type, created_at, updated_at, ai_summary FROM clients ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let clients = stmt
        .query_map([], |row| {
            Ok(Client {
                id: row.get(0)?,
                first_name: row.get(1)?,
                last_name: row.get(2)?,
                email: row.get(3)?,
                phone: row.get(4)?,
                income: get_opt_f64(row, 5)?,
                payg: get_opt_f64(row, 6)?,
                assets: get_opt_f64(row, 7)?,
                liabilities: get_opt_f64(row, 8)?,
                notes: row.get(9)?,
                home_address: row.get(10)?,
                investment_addresses: row.get(11)?,
                properties_viewing: row.get(12)?,
                available_deposit: get_opt_f64(row, 13)?,
                monthly_expenses: get_opt_f64(row, 14)?,
                goals: row.get(15)?,
                home_ownership: row.get(16)?,
                client_status: row.get::<_, Option<String>>(17)?.unwrap_or_else(|| "existing".to_string()),
                referral_source: row.get(18)?,
                pipeline_stage: row.get(19)?,
                current_lender: row.get(20)?,
                current_loan_balance: get_opt_f64(row, 21)?,
                current_interest_rate: get_opt_f64(row, 22)?,
                current_loan_type: row.get(23)?,
                created_at: row.get(24)?,
                updated_at: row.get(25)?,
                ai_summary: row.get(26)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(clients)
}

#[tauri::command]
pub fn create_client(state: State<AppState>, client: Client) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Local::now().to_rfc3339();

    conn.execute(
        "INSERT INTO clients (first_name, last_name, email, phone, income, payg, assets, liabilities, notes, home_address, investment_addresses, properties_viewing, available_deposit, monthly_expenses, goals, home_ownership, client_status, referral_source, pipeline_stage, current_lender, current_loan_balance, current_interest_rate, current_loan_type, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25)",
        rusqlite::params![
            client.first_name,
            client.last_name,
            client.email,
            client.phone,
            client.income,
            client.payg,
            client.assets,
            client.liabilities,
            client.notes,
            client.home_address.clone().unwrap_or_default(),
            client.investment_addresses.clone().unwrap_or_default(),
            client.properties_viewing.clone().unwrap_or_default(),
            client.available_deposit,
            client.monthly_expenses,
            client.goals.clone(),
            client.home_ownership.clone().unwrap_or_else(|| "owned".to_string()),
            client.client_status,
            client.referral_source.clone().unwrap_or_default(),
            client.pipeline_stage.clone().unwrap_or_else(|| "lead_received".to_string()),
            client.current_lender.clone().unwrap_or_default(),
            client.current_loan_balance,
            client.current_interest_rate,
            client.current_loan_type.clone().unwrap_or_default(),
            now,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_client(state: State<AppState>, client: Client) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Local::now().to_rfc3339();
    let client_id = client.id.ok_or("Client ID is required for update")?;

    conn.execute(
        "UPDATE clients SET first_name = ?1, last_name = ?2, email = ?3, phone = ?4, income = ?5, payg = ?6, assets = ?7, liabilities = ?8, notes = ?9, home_address = ?10, investment_addresses = ?11, properties_viewing = ?12, available_deposit = ?13, monthly_expenses = ?14, goals = ?15, home_ownership = ?16, client_status = ?17, referral_source = ?18, pipeline_stage = ?19, current_lender = ?20, current_loan_balance = ?21, current_interest_rate = ?22, current_loan_type = ?23, updated_at = ?24 WHERE id = ?25",
        rusqlite::params![
            client.first_name,
            client.last_name,
            client.email,
            client.phone,
            client.income,
            client.payg,
            client.assets,
            client.liabilities,
            client.notes,
            client.home_address.clone().unwrap_or_default(),
            client.investment_addresses.clone().unwrap_or_default(),
            client.properties_viewing.clone().unwrap_or_default(),
            client.available_deposit,
            client.monthly_expenses,
            client.goals.clone(),
            client.home_ownership.clone().unwrap_or_else(|| "owned".to_string()),
            client.client_status,
            client.referral_source.clone().unwrap_or_default(),
            client.pipeline_stage.clone().unwrap_or_else(|| "lead_received".to_string()),
            client.current_lender.clone().unwrap_or_default(),
            client.current_loan_balance,
            client.current_interest_rate,
            client.current_loan_type.clone().unwrap_or_default(),
            now,
            client_id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_client(state: State<AppState>, client_id: i64) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM deal_events WHERE deal_id IN (SELECT id FROM deals WHERE client_id = ?1)", [client_id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM deals WHERE client_id = ?1", [client_id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM documents WHERE client_id = ?1", [client_id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM meetings WHERE client_id = ?1", [client_id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM email_imports WHERE client_id = ?1", [client_id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM proposals WHERE client_id = ?1", [client_id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM clients WHERE id = ?1", [client_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn find_client_by_email(state: State<AppState>, email: String) -> Result<Option<Client>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let result = conn.query_row(
        "SELECT id, first_name, last_name, email, phone, income, payg, assets, liabilities, notes, home_address, investment_addresses, properties_viewing, available_deposit, monthly_expenses, goals, home_ownership, client_status, referral_source, pipeline_stage, current_lender, current_loan_balance, current_interest_rate, current_loan_type, created_at, updated_at, ai_summary
         FROM clients WHERE email = ?1",
        [&email],
        |row| {
            Ok(Client {
                id: row.get(0)?,
                first_name: row.get(1)?,
                last_name: row.get(2)?,
                email: row.get(3)?,
                phone: row.get(4)?,
                income: row.get(5)?,
                payg: row.get(6)?,
                assets: row.get(7)?,
                liabilities: row.get(8)?,
                notes: row.get(9)?,
                home_address: row.get(10)?,
                investment_addresses: row.get(11)?,
                properties_viewing: row.get(12)?,
                available_deposit: row.get(13)?,
                monthly_expenses: row.get(14)?,
                goals: row.get(15)?,
                home_ownership: row.get(16)?,
                client_status: row.get::<_, Option<String>>(17)?.unwrap_or_else(|| "existing".to_string()),
                referral_source: row.get(18)?,
                pipeline_stage: row.get(19)?,
                current_lender: row.get(20)?,
                current_loan_balance: row.get(21)?,
                current_interest_rate: row.get(22)?,
                current_loan_type: row.get(23)?,
                created_at: row.get(24)?,
                updated_at: row.get(25)?,
                ai_summary: row.get(26)?,
            })
        },
    );

    match result {
        Ok(client) => Ok(Some(client)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn update_client_status(state: State<AppState>, client_id: i64, status: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE clients SET client_status = ?1 WHERE id = ?2",
        rusqlite::params![status, client_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

use rusqlite::{Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

mod oauth;

pub struct AppState {
    db: Mutex<Connection>,
}

pub struct RecordingState {
    is_recording: AtomicBool,
    samples: Mutex<Vec<f32>>,
    sample_rate: Mutex<u32>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Client {
    pub id: Option<i64>,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub phone: String,
    pub income: Option<f64>,
    pub payg: Option<f64>,
    pub assets: Option<f64>,
    pub liabilities: Option<f64>,
    pub notes: String,
    pub home_address: Option<String>,
    pub investment_addresses: Option<String>,
    pub properties_viewing: Option<String>,
    pub available_deposit: Option<f64>,
    pub monthly_expenses: Option<f64>,
    pub goals: Option<String>,
    pub home_ownership: Option<String>,
    pub client_status: String,
    pub referral_source: Option<String>,
    pub pipeline_stage: Option<String>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ReferralStat {
    pub source: String,
    pub count: i64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct BankPolicy {
    pub id: Option<i64>,
    pub bank_name: String,
    pub policy_name: String,
    pub min_income: Option<f64>,
    pub max_ltv: Option<f64>,
    pub interest_rate: Option<f64>,
    pub requirements: String,
    pub notes: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Document {
    pub id: Option<i64>,
    pub client_id: i64,
    pub filename: String,
    pub document_type: String,
    pub file_path: String,
    pub file_data: Option<String>,
    pub uploaded_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Meeting {
    pub id: Option<i64>,
    pub client_id: i64,
    pub client_name: String,
    pub client_email: String,
    pub title: String,
    pub recording_path: Option<String>,
    pub transcript: Option<String>,
    pub summary: Option<String>,
    pub meeting_date: String,
    pub duration_seconds: Option<i64>,
    pub notes: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BrokerProfile {
    pub id: Option<i64>,
    pub name: String,
    pub email: String,
    pub phone: String,
    pub role: String,
    pub photo: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct EmailImport {
    pub id: Option<i64>,
    pub client_id: i64,
    pub sender_email: String,
    pub subject: String,
    pub document_path: String,
    pub imported_at: String,
    pub processed: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Deal {
    pub id: Option<i64>,
    pub client_id: i64,
    pub property_address: String,
    pub loan_amount: Option<f64>,
    pub purchase_date: Option<String>,
    pub settlement_date: Option<String>,
    pub interest_rate: Option<f64>,
    pub lender_name: Option<String>,
    pub loan_type: Option<String>,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DealEvent {
    pub id: Option<i64>,
    pub deal_id: i64,
    pub event_type: String,
    pub event_date: String,
    pub description: Option<String>,
    pub old_value: Option<String>,
    pub new_value: Option<String>,
    pub created_at: String,
}

// Database initialization
fn init_db(conn: &Connection) -> SqliteResult<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            income REAL,
            payg REAL,
            assets REAL,
            liabilities REAL,
            notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS bank_policies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bank_name TEXT NOT NULL,
            policy_name TEXT NOT NULL,
            min_income REAL,
            max_ltv REAL,
            interest_rate REAL,
            requirements TEXT,
            notes TEXT
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            document_type TEXT NOT NULL,
            file_path TEXT NOT NULL,
            uploaded_at TEXT NOT NULL,
            FOREIGN KEY (client_id) REFERENCES clients(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS meetings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            recording_path TEXT,
            transcript TEXT,
            summary TEXT,
            meeting_date TEXT NOT NULL,
            duration_seconds INTEGER,
            FOREIGN KEY (client_id) REFERENCES clients(id)
        )",
        [],
    )?;

    // Email auto-import table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS email_imports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            sender_email TEXT NOT NULL,
            subject TEXT NOT NULL,
            document_path TEXT NOT NULL,
            imported_at TEXT NOT NULL,
            processed BOOLEAN DEFAULT 0,
            FOREIGN KEY (client_id) REFERENCES clients(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS broker_profile (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            role TEXT,
            photo TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;

    // Create index for faster email lookups
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email)",
        [],
    )?;

    // Migration: ensure all client columns exist
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN income REAL", []);
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN payg REAL", []);
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN assets REAL", []);
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN liabilities REAL", []);
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN notes TEXT", []);

    // Migration: add address fields to clients
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN home_address TEXT", []);
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN investment_addresses TEXT", []);
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN properties_viewing TEXT", []);

    // Migration: add notes field to meetings
    let _ = conn.execute("ALTER TABLE meetings ADD COLUMN notes TEXT", []);

    // Migration: add new client financial fields
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN available_deposit REAL", []);
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN monthly_expenses REAL", []);
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN goals TEXT", []);

    // Migration: add client_status to clients
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN client_status TEXT DEFAULT 'existing'", []);

    // Migration: add file_data to documents for preview
    let _ = conn.execute("ALTER TABLE documents ADD COLUMN file_data TEXT", []);

    // Migration: add home_ownership to clients
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN home_ownership TEXT DEFAULT 'owned'", []);

    // Migration: add referral_source and pipeline_stage to clients
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN referral_source TEXT DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN pipeline_stage TEXT DEFAULT 'lead_received'", []);

    conn.execute(
        "CREATE TABLE IF NOT EXISTS proposals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            bank_policy_id INTEGER,
            proposal_content TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (client_id) REFERENCES clients(id),
            FOREIGN KEY (bank_policy_id) REFERENCES bank_policies(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS deals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            property_address TEXT NOT NULL,
            loan_amount REAL,
            purchase_date TEXT,
            settlement_date TEXT,
            interest_rate REAL,
            lender_name TEXT,
            loan_type TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (client_id) REFERENCES clients(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS deal_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            deal_id INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            event_date TEXT NOT NULL,
            description TEXT,
            old_value TEXT,
            new_value TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (deal_id) REFERENCES deals(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS oauth_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider TEXT NOT NULL UNIQUE,
            access_token TEXT NOT NULL,
            refresh_token TEXT,
            expires_at TEXT NOT NULL,
            account_email TEXT,
            scopes TEXT,
            last_sync_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;

    // Seed dummy data if no clients exist
    let client_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM clients", [], |row| row.get(0))
        .unwrap_or(0);

    if client_count == 0 {
        // Insert dummy client: Sarah Mitchell
        conn.execute(
            "INSERT INTO clients (first_name, last_name, email, phone, income, payg, assets, liabilities, notes, home_address, investment_addresses, properties_viewing, available_deposit, monthly_expenses, goals, client_status, referral_source, pipeline_stage, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)",
            [
                "Sarah", "Mitchell",
                "sarah.mitchell@email.com", "0412 345 678",
                "185000", "42000", "1250000", "620000",
                "Long-term client. First purchase was a townhouse in 2022, refinanced in 2023, now looking at a second investment property.",
                "42 Harbour View Rd, Mosman NSW 2088",
                "15 Ocean Ave, Bondi NSW 2026 | $1,450,000\n8/120 Pacific Hwy, North Sydney NSW 2060 | $820,000",
                "23 Rose Bay Ave, Rose Bay NSW 2029\n17 Coogee Bay Rd, Coogee NSW 2034",
                "320000", "6500",
                "Year 2: Acquire third investment property in Eastern Suburbs\nYear 5: Portfolio of 5 properties generating $150K+ passive income\nYear 10: Semi-retire with $3M+ equity across portfolio",
                "existing",
                "Referral",
                "post_settlement_review",
                "2022-03-15T10:00:00+11:00",
                "2026-02-20T14:30:00+11:00",
            ],
        )?;

        let sarah_id = conn.last_insert_rowid();

        // Meeting 1: Initial consultation for first purchase (2022)
        conn.execute(
            "INSERT INTO meetings (client_id, title, recording_path, transcript, summary, meeting_date, duration_seconds, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            [
                &sarah_id.to_string(),
                "Initial Consultation - First Home Purchase",
                "",
                "",
                "Sarah is looking to purchase her first investment property in Bondi. She has a household income of $185K and $200K in savings. Discussed pre-approval process with CBA and Westpac. She prefers a fixed rate for the first 2 years.",
                "2022-03-15T10:00:00+11:00",
                "2700",
                "Very organised client, brought all documents. Pre-approval target: $900K. Follow up with CBA rate lock options.",
            ],
        )?;

        // Meeting 2: Settlement and deal close (2022)
        conn.execute(
            "INSERT INTO meetings (client_id, title, recording_path, transcript, summary, meeting_date, duration_seconds, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            [
                &sarah_id.to_string(),
                "Settlement Finalisation - 15 Ocean Ave, Bondi",
                "",
                "",
                "Finalised the purchase of 15 Ocean Ave, Bondi for $780K through CBA with a 2-year fixed rate at 3.89%. LVR at 78%. Sarah was very happy with the process. Discussed future investment strategy and she mentioned wanting to look at a second property in 1-2 years.",
                "2022-06-20T14:00:00+10:00",
                "1800",
                "Deal closed. CBA loan settled. Sarah plans to revisit in 2024 for second property. Set calendar reminder.",
            ],
        )?;

        // Meeting 3: Second property purchase discussion (2024)
        conn.execute(
            "INSERT INTO meetings (client_id, title, recording_path, transcript, summary, meeting_date, duration_seconds, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            [
                &sarah_id.to_string(),
                "Second Investment Property - North Sydney Unit",
                "",
                "",
                "Sarah is ready to purchase a second investment property. Looking at a 2-bed unit at 8/120 Pacific Hwy, North Sydney for $820K. Her first property has appreciated to approx $1.45M. Discussed using equity from Bondi property. Exploring ANZ and Westpac for competitive investor rates. Current serviceability looks strong with rental income from Bondi property at $850/week.",
                "2024-08-10T11:00:00+10:00",
                "3600",
                "Strong equity position from first property. Rental income helps serviceability. Compare ANZ vs Westpac investor rates. Sarah also mentioned wanting to look at Rose Bay and Coogee for future purchases.",
            ],
        )?;
    }

    // Seed dummy bank policies if none exist
    let policy_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM bank_policies", [], |row| row.get(0))
        .unwrap_or(0);

    if policy_count == 0 {
        let policies = vec![
            ("Commonwealth Bank", "Standard Variable Home Loan", 60000.0, 80.0, 6.49, "Full doc, min 20% deposit, PAYG or self-employed with 2yr history", "Most popular CBA product. Offset account included."),
            ("Commonwealth Bank", "Fixed Rate 2 Year", 60000.0, 90.0, 5.99, "Full doc, LMI applies for LVR >80%, min 10% deposit", "Rate locked for 2 years. No offset during fixed period."),
            ("Commonwealth Bank", "Investor Interest Only", 80000.0, 70.0, 6.79, "Investment purpose only, max 5yr IO period, full doc required", "Interest-only repayments for up to 5 years. Strong serviceability required."),
            ("Westpac", "Flexi First Home Buyer", 50000.0, 95.0, 6.19, "First home buyers only, LMI waived for LVR <=90% with FHBG", "First Home Buyer Guarantee eligible. Flexible repayments."),
            ("Westpac", "Premier Advantage Package", 100000.0, 80.0, 5.89, "Min income $100K, full doc, package fee $395/yr waived yr 1", "Lowest variable rate. Includes rate discount, fee waivers, and credit card."),
            ("Westpac", "Investor Variable Rate", 70000.0, 80.0, 6.59, "Investment purpose, P&I or IO available, full doc", "Competitive investor rate with optional offset."),
            ("ANZ", "Simplicity PLUS Home Loan", 55000.0, 80.0, 6.24, "Full doc, no ongoing fees, min 20% deposit", "No annual fee, no application fee. Simple and competitive."),
            ("ANZ", "Residential Investment Loan", 75000.0, 70.0, 6.54, "Investment only, full doc, 30% deposit preferred for best rate", "Tailored for investors. Multiple offset accounts available."),
            ("NAB", "Tailored Home Loan", 55000.0, 85.0, 6.34, "Full doc, flexible LVR up to 85% without LMI for healthcare/professional", "Professional package available for doctors, lawyers, accountants."),
            ("NAB", "Investor Rate Saver", 65000.0, 75.0, 6.44, "Investment purpose, full doc, no offset account", "Lower rate in exchange for no offset. Suitable for simple investment loans."),
        ];

        for (bank, name, min_inc, max_ltv, rate, reqs, notes) in policies {
            conn.execute(
                "INSERT INTO bank_policies (bank_name, policy_name, min_income, max_ltv, interest_rate, requirements, notes)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                [bank, name, &min_inc.to_string(), &max_ltv.to_string(), &rate.to_string(), reqs, notes],
            )?;
        }
    }

    // Seed dummy deals if none exist
    let deal_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM deals", [], |row| row.get(0))
        .unwrap_or(0);

    if deal_count == 0 && client_count > 0 {
        let sarah_id: i64 = conn
            .query_row("SELECT id FROM clients WHERE first_name = 'Sarah' AND last_name = 'Mitchell'", [], |row| row.get(0))
            .unwrap_or(1);

        // Deal 1: Bondi investment property
        conn.execute(
            "INSERT INTO deals (client_id, property_address, loan_amount, purchase_date, settlement_date, interest_rate, lender_name, loan_type, status, notes, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            rusqlite::params![
                sarah_id, "15 Ocean Ave, Bondi NSW 2026", 780000.0,
                "2022-04-10", "2022-06-20", 3.89,
                "Commonwealth Bank", "fixed", "active",
                "First investment property. 2-year fixed rate. LVR 78%.",
                "2022-06-20T14:00:00+10:00", "2024-03-15T10:00:00+11:00"
            ],
        )?;
        let deal1_id = conn.last_insert_rowid();

        // Deal 1 events
        conn.execute(
            "INSERT INTO deal_events (deal_id, event_type, event_date, description, old_value, new_value, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![deal1_id, "purchase", "2022-04-10", "Contract exchanged for 15 Ocean Ave, Bondi", "", "$780,000", "2022-04-10T10:00:00+10:00"],
        )?;
        conn.execute(
            "INSERT INTO deal_events (deal_id, event_type, event_date, description, old_value, new_value, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![deal1_id, "settlement", "2022-06-20", "Settlement completed through CBA", "", "Settled", "2022-06-20T14:00:00+10:00"],
        )?;
        conn.execute(
            "INSERT INTO deal_events (deal_id, event_type, event_date, description, old_value, new_value, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![deal1_id, "rate_change", "2024-04-10", "Fixed period expired, rolled to variable rate", "3.89%", "6.49%", "2024-04-10T09:00:00+10:00"],
        )?;
        conn.execute(
            "INSERT INTO deal_events (deal_id, event_type, event_date, description, old_value, new_value, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![deal1_id, "refinance", "2024-06-01", "Refinanced to ANZ for better investor rate", "CBA 6.49%", "ANZ 5.99%", "2024-06-01T11:00:00+10:00"],
        )?;

        // Deal 2: North Sydney unit
        conn.execute(
            "INSERT INTO deals (client_id, property_address, loan_amount, purchase_date, settlement_date, interest_rate, lender_name, loan_type, status, notes, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            rusqlite::params![
                sarah_id, "8/120 Pacific Hwy, North Sydney NSW 2060", 820000.0,
                "2024-09-15", "2024-11-20", 5.89,
                "Westpac", "variable", "active",
                "Second investment property. Used equity from Bondi property.",
                "2024-11-20T10:00:00+11:00", "2024-11-20T10:00:00+11:00"
            ],
        )?;
        let deal2_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO deal_events (deal_id, event_type, event_date, description, old_value, new_value, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![deal2_id, "purchase", "2024-09-15", "Contract exchanged for 8/120 Pacific Hwy, North Sydney", "", "$820,000", "2024-09-15T10:00:00+10:00"],
        )?;
        conn.execute(
            "INSERT INTO deal_events (deal_id, event_type, event_date, description, old_value, new_value, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![deal2_id, "settlement", "2024-11-20", "Settlement completed through Westpac Premier Advantage", "", "Settled", "2024-11-20T10:00:00+11:00"],
        )?;
    }

    Ok(())
}

// Commands
#[tauri::command]
fn get_clients(state: State<AppState>) -> Result<Vec<Client>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, first_name, last_name, email, phone, income, payg, assets, liabilities, notes, home_address, investment_addresses, properties_viewing, available_deposit, monthly_expenses, goals, home_ownership, client_status, referral_source, pipeline_stage, created_at, updated_at FROM clients ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    // Helper: read a column that may be stored as REAL or TEXT
    fn get_opt_f64(row: &rusqlite::Row, idx: usize) -> rusqlite::Result<Option<f64>> {
        match row.get::<_, Option<f64>>(idx) {
            Ok(v) => Ok(v),
            Err(_) => {
                let s: Option<String> = row.get(idx)?;
                Ok(s.and_then(|s| s.parse::<f64>().ok()))
            }
        }
    }

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
                created_at: row.get(20)?,
                updated_at: row.get(21)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(clients)
}

#[tauri::command]
fn create_client(state: State<AppState>, client: Client) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Local::now().to_rfc3339();

    conn.execute(
        "INSERT INTO clients (first_name, last_name, email, phone, income, payg, assets, liabilities, notes, home_address, investment_addresses, properties_viewing, available_deposit, monthly_expenses, goals, home_ownership, client_status, referral_source, pipeline_stage, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)",
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
            now,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn update_client(state: State<AppState>, client: Client) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Local::now().to_rfc3339();
    let client_id = client.id.ok_or("Client ID is required for update")?;

    conn.execute(
        "UPDATE clients SET first_name = ?1, last_name = ?2, email = ?3, phone = ?4, income = ?5, payg = ?6, assets = ?7, liabilities = ?8, notes = ?9, home_address = ?10, investment_addresses = ?11, properties_viewing = ?12, available_deposit = ?13, monthly_expenses = ?14, goals = ?15, home_ownership = ?16, client_status = ?17, referral_source = ?18, pipeline_stage = ?19, updated_at = ?20 WHERE id = ?21",
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
            now,
            client_id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn delete_client(state: State<AppState>, client_id: i64) -> Result<(), String> {
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
fn get_bank_policies(state: State<AppState>) -> Result<Vec<BankPolicy>, String> {
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
fn create_bank_policy(state: State<AppState>, policy: BankPolicy) -> Result<i64, String> {
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

#[tauri::command]
fn get_dashboard_stats(state: State<AppState>) -> Result<serde_json::Value, String> {
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
        // Dummy analytics data for demo
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
fn get_referral_stats(state: State<AppState>) -> Result<Vec<ReferralStat>, String> {
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

// Deal commands
#[tauri::command]
fn get_client_deals(state: State<AppState>, client_id: i64) -> Result<Vec<Deal>, String> {
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
fn create_deal(state: State<AppState>, deal: Deal) -> Result<i64, String> {
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
fn get_deal_events(state: State<AppState>, deal_id: i64) -> Result<Vec<DealEvent>, String> {
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
fn create_deal_event(state: State<AppState>, event: DealEvent) -> Result<i64, String> {
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

// Meeting commands
#[tauri::command]
fn save_meeting(state: State<AppState>, meeting: Meeting) -> Result<i64, String> {
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
fn get_meetings(state: State<AppState>) -> Result<Vec<Meeting>, String> {
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
fn get_client_meetings(state: State<AppState>, client_id: i64) -> Result<Vec<Meeting>, String> {
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

// Email auto-import commands
#[tauri::command]
fn find_client_by_email(state: State<AppState>, email: String) -> Result<Option<Client>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let result = conn.query_row(
        "SELECT id, first_name, last_name, email, phone, income, payg, assets, liabilities, notes, home_address, investment_addresses, properties_viewing, available_deposit, monthly_expenses, goals, home_ownership, client_status, referral_source, pipeline_stage, created_at, updated_at
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
                created_at: row.get(20)?,
                updated_at: row.get(21)?,
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
fn update_client_status(state: State<AppState>, client_id: i64, status: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE clients SET client_status = ?1 WHERE id = ?2",
        rusqlite::params![status, client_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Classify a document type based on filename and email subject.
/// Returns one of: "payslip", "bank_statement", "id_document", or "other".
pub fn classify_document_type<'a>(filename: &str, subject: &str) -> &'a str {
    let fname_lower = filename.to_lowercase();
    let subj_lower = subject.to_lowercase();

    if fname_lower.contains("payslip") || subj_lower.contains("payslip") {
        "payslip"
    } else if fname_lower.contains("bank")
        || subj_lower.contains("bank")
        || fname_lower.contains("statement")
    {
        "bank_statement"
    } else if fname_lower.contains("id")
        || fname_lower.contains("license")
        || fname_lower.contains("passport")
    {
        "id_document"
    } else {
        "other"
    }
}

/// Detect MIME type from a file extension string.
/// Returns the MIME type as a static string.
pub fn detect_mime_type(extension: &str) -> &'static str {
    match extension.to_lowercase().as_str() {
        "pdf" => "application/pdf",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xls" => "application/vnd.ms-excel",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        _ => "application/octet-stream",
    }
}

/// Shared import logic used by both the Tauri command and OAuth email sync.
pub fn do_import_email_document(
    conn: &Connection,
    sender_email: &str,
    subject: &str,
    document_path: &str,
) -> Result<i64, String> {
    let client_id: Option<i64> = conn
        .query_row(
            "SELECT id FROM clients WHERE email = ?1",
            [sender_email],
            |row| row.get(0),
        )
        .ok();

    let client_id = match client_id {
        Some(id) => id,
        None => {
            return Err(format!("No client found with email: {}", sender_email));
        }
    };

    // Use actual filename from path, not subject
    let filename = std::path::Path::new(document_path)
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| subject.to_string());

    let document_type = classify_document_type(&filename, subject);

    // Read file data as base64 for in-app preview
    let file_data = match std::fs::read(document_path) {
        Ok(bytes) => {
            use base64::{engine::general_purpose::STANDARD, Engine as _};
            let ext = std::path::Path::new(document_path)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("");
            let mime = detect_mime_type(ext);
            format!("data:{};base64,{}", mime, STANDARD.encode(&bytes))
        }
        Err(_) => String::new(),
    };

    let now = chrono::Local::now().to_rfc3339();
    conn.execute(
        "INSERT INTO documents (client_id, filename, document_type, file_path, file_data, uploaded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        [
            &client_id.to_string(),
            &filename,
            document_type,
            document_path,
            &file_data,
            &now,
        ],
    )
    .map_err(|e| e.to_string())?;

    let document_id = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO email_imports (client_id, sender_email, subject, document_path, imported_at, processed)
         VALUES (?1, ?2, ?3, ?4, ?5, 1)",
        [
            &client_id.to_string(),
            sender_email,
            subject,
            document_path,
            &now,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(document_id)
}

#[tauri::command]
fn import_email_document(
    state: State<AppState>,
    sender_email: String,
    subject: String,
    document_path: String,
) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    do_import_email_document(&conn, &sender_email, &subject, &document_path)
}

#[tauri::command]
fn get_recent_email_imports(state: State<AppState>, limit: i64) -> Result<Vec<EmailImport>, String> {
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

#[tauri::command]
fn get_client_documents(state: State<AppState>, client_id: i64) -> Result<Vec<Document>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, client_id, filename, document_type, file_path, uploaded_at FROM documents WHERE client_id = ?1 ORDER BY uploaded_at DESC")
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
                uploaded_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(docs)
}

#[tauri::command]
fn upload_client_document(
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
fn get_document_data(state: State<AppState>, document_id: i64) -> Result<Option<String>, String> {
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
fn open_file(path: String) -> Result<(), String> {
    if !std::path::Path::new(&path).exists() {
        return Err("File not found on disk".to_string());
    }
    open::that(&path).map_err(|e| format!("Failed to open file: {}", e))
}

#[tauri::command]
fn rename_document(state: State<AppState>, document_id: i64, new_name: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE documents SET filename = ?1 WHERE id = ?2",
        rusqlite::params![new_name, document_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_document(state: State<AppState>, document_id: i64) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    // Get file path to delete from disk too
    let file_path: Option<String> = conn
        .query_row("SELECT file_path FROM documents WHERE id = ?1", [document_id], |row| row.get(0))
        .ok();
    conn.execute("DELETE FROM documents WHERE id = ?1", [document_id])
        .map_err(|e| e.to_string())?;
    // Try to delete file from disk
    if let Some(path) = file_path {
        let _ = std::fs::remove_file(&path);
    }
    Ok(())
}

#[tauri::command]
fn get_broker_profile(state: State<AppState>) -> Result<Option<BrokerProfile>, String> {
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
fn save_broker_profile(state: State<AppState>, profile: BrokerProfile) -> Result<BrokerProfile, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Local::now().to_rfc3339();

    // Check if a profile already exists
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

// Native audio recording
#[tauri::command]
fn start_recording(recording: State<RecordingState>) -> Result<String, String> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

    if recording.is_recording.load(Ordering::SeqCst) {
        return Err("Already recording".to_string());
    }

    // Clear previous samples
    {
        let mut samples = recording.samples.lock().map_err(|e| e.to_string())?;
        samples.clear();
    }

    recording.is_recording.store(true, Ordering::SeqCst);

    let host = cpal::default_host();
    let device = host.default_input_device()
        .ok_or_else(|| {
            recording.is_recording.store(false, Ordering::SeqCst);
            "No input device available".to_string()
        })?;

    let config = device.default_input_config()
        .map_err(|e| {
            recording.is_recording.store(false, Ordering::SeqCst);
            format!("Failed to get input config: {}", e)
        })?;

    {
        let mut sr = recording.sample_rate.lock().map_err(|e| {
            recording.is_recording.store(false, Ordering::SeqCst);
            e.to_string()
        })?;
        *sr = config.sample_rate().0;
    }

    let is_recording = Arc::new(AtomicBool::new(true));
    let is_recording_clone = is_recording.clone();

    // Spawn recording thread
    let samples_arc: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));
    let samples_for_callback = samples_arc.clone();
    // Store the Arc in a global so stop_recording can access it
    let recording_flag = recording.is_recording.load(Ordering::SeqCst);
    let _ = recording_flag;

    // Build and play the stream in a separate thread
    std::thread::spawn(move || {
        let stream = match config.sample_format() {
            cpal::SampleFormat::F32 => {
                let samples = samples_for_callback.clone();
                let is_rec = is_recording_clone.clone();
                device.build_input_stream(
                    &config.into(),
                    move |data: &[f32], _: &cpal::InputCallbackInfo| {
                        if is_rec.load(Ordering::SeqCst) {
                            if let Ok(mut s) = samples.lock() {
                                s.extend_from_slice(data);
                            }
                        }
                    },
                    |err| eprintln!("Recording error: {}", err),
                    None,
                )
            }
            cpal::SampleFormat::I16 => {
                let samples = samples_for_callback.clone();
                let is_rec = is_recording_clone.clone();
                device.build_input_stream(
                    &config.into(),
                    move |data: &[i16], _: &cpal::InputCallbackInfo| {
                        if is_rec.load(Ordering::SeqCst) {
                            if let Ok(mut s) = samples.lock() {
                                s.extend(data.iter().map(|&v| v as f32 / 32768.0));
                            }
                        }
                    },
                    |err| eprintln!("Recording error: {}", err),
                    None,
                )
            }
            _ => {
                eprintln!("Unsupported sample format");
                return;
            }
        };

        match stream {
            Ok(s) => {
                if let Err(e) = s.play() {
                    eprintln!("Failed to start stream: {}", e);
                    return;
                }
                // Keep thread alive while recording
                while is_recording_clone.load(Ordering::SeqCst) {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
                drop(s);
                // Copy samples to state
            }
            Err(e) => {
                eprintln!("Failed to build stream: {}", e);
            }
        }
    });

    // Store the Arc references globally for stop
    RECORDING_SAMPLES.lock().map_err(|e| {
        recording.is_recording.store(false, Ordering::SeqCst);
        e.to_string()
    })?.replace(samples_arc);
    RECORDING_FLAG.lock().map_err(|e| {
        recording.is_recording.store(false, Ordering::SeqCst);
        e.to_string()
    })?.replace(is_recording);

    Ok("Recording started".to_string())
}

// Global state for the recording thread communication
lazy_static::lazy_static! {
    static ref RECORDING_SAMPLES: Mutex<Option<Arc<Mutex<Vec<f32>>>>> = Mutex::new(None);
    static ref RECORDING_FLAG: Mutex<Option<Arc<AtomicBool>>> = Mutex::new(None);
}

#[tauri::command]
fn stop_recording(recording: State<RecordingState>) -> Result<Vec<u8>, String> {
    recording.is_recording.store(false, Ordering::SeqCst);

    // Signal the recording thread to stop
    if let Ok(flag_guard) = RECORDING_FLAG.lock() {
        if let Some(flag) = flag_guard.as_ref() {
            flag.store(false, Ordering::SeqCst);
        }
    }

    // Give the thread a moment to flush
    std::thread::sleep(std::time::Duration::from_millis(300));

    // Get the samples
    let samples = if let Ok(samples_guard) = RECORDING_SAMPLES.lock() {
        if let Some(samples_arc) = samples_guard.as_ref() {
            samples_arc.lock().map_err(|e| e.to_string())?.clone()
        } else {
            return Err("No recording data".to_string());
        }
    } else {
        return Err("Failed to access recording data".to_string());
    };

    let sample_rate = *recording.sample_rate.lock().map_err(|e| e.to_string())?;
    if sample_rate == 0 || samples.is_empty() {
        return Err("No audio recorded".to_string());
    }

    // Convert to mono if multi-channel (default input is usually mono, but handle stereo)
    let mono = samples.clone();

    // Resample to 16kHz for Whisper
    let target_rate = 16000u32;
    let resampled = if sample_rate != target_rate {
        let ratio = sample_rate as f64 / target_rate as f64;
        let new_len = (mono.len() as f64 / ratio) as usize;
        (0..new_len)
            .map(|i| {
                let src_idx = (i as f64 * ratio) as usize;
                mono.get(src_idx).copied().unwrap_or(0.0)
            })
            .collect::<Vec<f32>>()
    } else {
        mono
    };

    // Build WAV
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: target_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut wav_data = Vec::new();
    {
        let cursor = std::io::Cursor::new(&mut wav_data);
        let mut writer = hound::WavWriter::new(cursor, spec)
            .map_err(|e| format!("Failed to create WAV: {}", e))?;
        for &sample in &resampled {
            let s = (sample * 32767.0).clamp(-32768.0, 32767.0) as i16;
            writer.write_sample(s).map_err(|e| format!("Failed to write sample: {}", e))?;
        }
        writer.finalize().map_err(|e| format!("Failed to finalize WAV: {}", e))?;
    }

    // Clean up globals
    if let Ok(mut g) = RECORDING_SAMPLES.lock() { *g = None; }
    if let Ok(mut g) = RECORDING_FLAG.lock() { *g = None; }

    Ok(wav_data)
}

// Whisper model - downloaded on first use to app data directory
const WHISPER_MODEL_FILENAME: &str = "ggml-large-v3.bin";
const WHISPER_MODEL_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin";

fn get_model_dir() -> Result<std::path::PathBuf, String> {
    let dir = dirs::data_dir()
        .ok_or("Failed to get data directory")?
        .join("BrokerageCRM");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn get_model_path() -> Result<std::path::PathBuf, String> {
    Ok(get_model_dir()?.join(WHISPER_MODEL_FILENAME))
}

#[tauri::command]
fn check_whisper_model() -> Result<bool, String> {
    let path = get_model_path()?;
    Ok(path.exists())
}

#[tauri::command]
fn get_whisper_model_status() -> Result<serde_json::Value, String> {
    let path = get_model_path()?;
    let exists = path.exists();
    let size = if exists {
        std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };
    Ok(serde_json::json!({
        "downloaded": exists,
        "model_name": WHISPER_MODEL_FILENAME,
        "size_bytes": size,
        "path": path.to_string_lossy(),
    }))
}

#[tauri::command]
async fn download_whisper_model(app: AppHandle) -> Result<String, String> {
    let model_path = get_model_path()?;
    if model_path.exists() {
        return Ok("Model already downloaded".to_string());
    }

    let temp_path = model_path.with_extension("bin.downloading");

    let client = reqwest::Client::new();
    let resp = client
        .get(WHISPER_MODEL_URL)
        .send()
        .await
        .map_err(|e| format!("Download request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Download failed with status: {}", resp.status()));
    }

    let total_size = resp.content_length().unwrap_or(0);

    let mut file = std::fs::File::create(&temp_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;

    use std::io::Write;
    let mut downloaded: u64 = 0;
    let mut stream = resp.bytes_stream();
    use futures_util::StreamExt;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Write error: {}", e))?;
        downloaded += chunk.len() as u64;

        // Emit progress event
        if total_size > 0 {
            let pct = (downloaded as f64 / total_size as f64 * 100.0) as u32;
            let _ = app.emit("whisper-download-progress", serde_json::json!({
                "downloaded": downloaded,
                "total": total_size,
                "percent": pct,
            }));
        }
    }

    drop(file);

    // Rename temp file to final path
    std::fs::rename(&temp_path, &model_path)
        .map_err(|e| format!("Failed to finalize download: {}", e))?;

    Ok("Download complete".to_string())
}

#[tauri::command]
fn transcribe_audio(audio_data: Vec<u8>) -> Result<String, String> {
    let model_path = get_model_path()?;
    if !model_path.exists() {
        return Err("Whisper model not downloaded. Go to Settings to download it.".to_string());
    }

    // Parse WAV file
    let cursor = std::io::Cursor::new(audio_data);
    let mut reader = hound::WavReader::new(cursor)
        .map_err(|e| format!("Failed to read WAV data: {}", e))?;

    let spec = reader.spec();
    let samples: Vec<f32> = if spec.sample_format == hound::SampleFormat::Float {
        reader.samples::<f32>()
            .filter_map(|s| s.ok())
            .collect()
    } else {
        reader.samples::<i16>()
            .filter_map(|s| s.ok())
            .map(|s| s as f32 / 32768.0)
            .collect()
    };

    // Convert to mono if stereo
    let mono_samples: Vec<f32> = if spec.channels == 2 {
        samples.chunks(2).map(|c| (c[0] + c.get(1).copied().unwrap_or(0.0)) / 2.0).collect()
    } else {
        samples
    };

    // Resample to 16kHz if needed
    let target_rate = 16000;
    let resampled = if spec.sample_rate != target_rate {
        let ratio = spec.sample_rate as f64 / target_rate as f64;
        let new_len = (mono_samples.len() as f64 / ratio) as usize;
        (0..new_len)
            .map(|i| {
                let src_idx = (i as f64 * ratio) as usize;
                mono_samples.get(src_idx).copied().unwrap_or(0.0)
            })
            .collect()
    } else {
        mono_samples
    };

    // Initialize whisper
    let ctx = whisper_rs::WhisperContext::new_with_params(
        model_path.to_str().unwrap(),
        whisper_rs::WhisperContextParameters::default(),
    )
    .map_err(|e| format!("Failed to load Whisper model: {}", e))?;

    let mut state = ctx.create_state()
        .map_err(|e| format!("Failed to create Whisper state: {}", e))?;

    let mut params = whisper_rs::FullParams::new(whisper_rs::SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some("en"));
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);

    state.full(params, &resampled)
        .map_err(|e| format!("Transcription failed: {}", e))?;

    let num_segments = state.full_n_segments()
        .map_err(|e| format!("Failed to get segments: {}", e))?;

    let mut transcript = String::new();
    for i in 0..num_segments {
        if let Ok(text) = state.full_get_segment_text(i) {
            transcript.push_str(&text);
            transcript.push(' ');
        }
    }

    Ok(transcript.trim().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = dirs::data_dir()
        .expect("Failed to get data directory")
        .join("BrokerageCRM")
        .join("database.db");

    std::fs::create_dir_all(db_path.parent().unwrap()).expect("Failed to create app directory");

    let conn = Connection::open(&db_path).expect("Failed to open database");
    init_db(&conn).expect("Failed to initialize database");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState { db: Mutex::new(conn) })
        .manage(RecordingState {
            is_recording: AtomicBool::new(false),
            samples: Mutex::new(Vec::new()),
            sample_rate: Mutex::new(0),
        })
        .invoke_handler(tauri::generate_handler![
            get_clients,
            create_client,
            update_client,
            delete_client,
            get_bank_policies,
            create_bank_policy,
            get_dashboard_stats,
            get_referral_stats,
            get_client_deals,
            create_deal,
            get_deal_events,
            create_deal_event,
            save_meeting,
            get_meetings,
            get_client_meetings,
            find_client_by_email,
            update_client_status,
            import_email_document,
            get_recent_email_imports,
            get_client_documents,
            upload_client_document,
            get_document_data,
            open_file,
            rename_document,
            delete_document,
            get_broker_profile,
            save_broker_profile,
            start_recording,
            stop_recording,
            check_whisper_model,
            get_whisper_model_status,
            download_whisper_model,
            transcribe_audio,
            oauth::start_oauth,
            oauth::check_oauth_status,
            oauth::disconnect_oauth,
            oauth::sync_emails,
            oauth::create_calendar_event,
            oauth::get_upcoming_meetings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    // -----------------------------------------------------------------------
    // classify_document_type tests
    // -----------------------------------------------------------------------

    #[test]
    fn classify_payslip_by_filename() {
        assert_eq!(classify_document_type("payslip_march.pdf", ""), "payslip");
    }

    #[test]
    fn classify_bank_statement_by_filename() {
        assert_eq!(
            classify_document_type("bank_statement_2024.pdf", ""),
            "bank_statement"
        );
    }

    #[test]
    fn classify_statement_keyword_in_filename() {
        assert_eq!(
            classify_document_type("statement_jan.pdf", ""),
            "bank_statement"
        );
    }

    #[test]
    fn classify_drivers_license_as_id_document() {
        assert_eq!(
            classify_document_type("drivers_license.jpg", ""),
            "id_document"
        );
    }

    #[test]
    fn classify_passport_as_id_document() {
        assert_eq!(
            classify_document_type("passport_scan.png", ""),
            "id_document"
        );
    }

    #[test]
    fn classify_generic_filename_as_other() {
        assert_eq!(classify_document_type("random_doc.pdf", ""), "other");
    }

    #[test]
    fn classify_payslip_from_subject_with_generic_filename() {
        assert_eq!(
            classify_document_type("attachment.pdf", "Your payslip for March"),
            "payslip"
        );
    }

    #[test]
    fn classify_bank_from_subject() {
        assert_eq!(
            classify_document_type("document.pdf", "Bank correspondence"),
            "bank_statement"
        );
    }

    #[test]
    fn classify_case_insensitive_filename() {
        assert_eq!(classify_document_type("PAYSLIP_MARCH.PDF", ""), "payslip");
        assert_eq!(
            classify_document_type("Bank_Statement.pdf", ""),
            "bank_statement"
        );
        assert_eq!(
            classify_document_type("PASSPORT_scan.PNG", ""),
            "id_document"
        );
    }

    #[test]
    fn classify_case_insensitive_subject() {
        assert_eq!(
            classify_document_type("file.pdf", "PAYSLIP for employee"),
            "payslip"
        );
        assert_eq!(
            classify_document_type("file.pdf", "BANK statement enclosed"),
            "bank_statement"
        );
    }

    #[test]
    fn classify_id_keyword_in_filename() {
        // "id" is a substring match, so filenames containing "id" match
        assert_eq!(classify_document_type("national_id.pdf", ""), "id_document");
    }

    // -----------------------------------------------------------------------
    // detect_mime_type tests
    // -----------------------------------------------------------------------

    #[test]
    fn mime_pdf() {
        assert_eq!(detect_mime_type("pdf"), "application/pdf");
    }

    #[test]
    fn mime_png() {
        assert_eq!(detect_mime_type("png"), "image/png");
    }

    #[test]
    fn mime_jpg() {
        assert_eq!(detect_mime_type("jpg"), "image/jpeg");
    }

    #[test]
    fn mime_jpeg() {
        assert_eq!(detect_mime_type("jpeg"), "image/jpeg");
    }

    #[test]
    fn mime_doc() {
        assert_eq!(detect_mime_type("doc"), "application/msword");
    }

    #[test]
    fn mime_docx() {
        assert_eq!(
            detect_mime_type("docx"),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
    }

    #[test]
    fn mime_xls() {
        assert_eq!(detect_mime_type("xls"), "application/vnd.ms-excel");
    }

    #[test]
    fn mime_xlsx() {
        assert_eq!(
            detect_mime_type("xlsx"),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
    }

    #[test]
    fn mime_unknown_extension() {
        assert_eq!(detect_mime_type("zip"), "application/octet-stream");
        assert_eq!(detect_mime_type("txt"), "application/octet-stream");
        assert_eq!(detect_mime_type(""), "application/octet-stream");
    }

    #[test]
    fn mime_case_insensitive() {
        assert_eq!(detect_mime_type("PDF"), "application/pdf");
        assert_eq!(detect_mime_type("Png"), "image/png");
        assert_eq!(detect_mime_type("JPG"), "image/jpeg");
    }
}

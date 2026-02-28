use rusqlite::{Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    db: Mutex<Connection>,
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
    pub created_at: String,
    pub updated_at: String,
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

    // Create index for faster email lookups
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email)",
        [],
    )?;

    // Migration: rename payg → payg if old column exists
    let _ = conn.execute("ALTER TABLE clients RENAME COLUMN payg TO payg", []);

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

    Ok(())
}

// Commands
#[tauri::command]
fn get_clients(state: State<AppState>) -> Result<Vec<Client>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, first_name, last_name, email, phone, income, payg, assets, liabilities, notes, created_at, updated_at FROM clients ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let clients = stmt
        .query_map([], |row| {
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
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
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
        "INSERT INTO clients (first_name, last_name, email, phone, income, payg, assets, liabilities, notes, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        [
            &client.first_name,
            &client.last_name,
            &client.email,
            &client.phone,
            &client.income.map(|v| v.to_string()).unwrap_or_default(),
            &client.payg.map(|v| v.to_string()).unwrap_or_default(),
            &client.assets.map(|v| v.to_string()).unwrap_or_default(),
            &client.liabilities.map(|v| v.to_string()).unwrap_or_default(),
            &client.notes,
            &now,
            &now,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
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
                "INSERT INTO clients (first_name, last_name, email, phone, income, payg, assets, liabilities, notes, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                [
                    &first_name,
                    &last_name,
                    &meeting.client_email,
                    "",
                    "",
                    "",
                    "",
                    "",
                    "Auto-created from meeting recording",
                    &now,
                    &now,
                ],
            )
            .map_err(|e| e.to_string())?;

            conn.last_insert_rowid()
        }
    };

    // Insert the meeting
    let now = chrono::Local::now().to_rfc3339();
    conn.execute(
        "INSERT INTO meetings (client_id, title, recording_path, transcript, summary, meeting_date, duration_seconds)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        [
            &client_id.to_string(),
            &format!("Meeting with {}", meeting.client_name),
            &meeting.recording_path.unwrap_or_default(),
            &meeting.transcript.unwrap_or_default(),
            &meeting.summary.unwrap_or_default(),
            &now,
            &meeting.duration_seconds.map(|v| v.to_string()).unwrap_or_default(),
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn get_meetings(state: State<AppState>) -> Result<Vec<Meeting>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT m.id, m.client_id, c.first_name || ' ' || c.last_name as client_name, c.email, m.title, m.recording_path, m.transcript, m.summary, m.meeting_date, m.duration_seconds
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
        "SELECT id, first_name, last_name, email, phone, income, payg, assets, liabilities, notes, created_at, updated_at
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
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
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
fn import_email_document(
    state: State<AppState>,
    sender_email: String,
    subject: String,
    document_path: String,
) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    // Find client by sender email
    let client_id: Option<i64> = conn
        .query_row(
            "SELECT id FROM clients WHERE email = ?1",
            [&sender_email],
            |row| row.get(0),
        )
        .ok();

    let client_id = match client_id {
        Some(id) => id,
        None => {
            return Err(format!("No client found with email: {}", sender_email));
        }
    };

    // Determine document type from subject/filename
    let document_type = if subject.to_lowercase().contains("payslip")
        || document_path.to_lowercase().contains("payslip")
    {
        "payslip"
    } else if subject.to_lowercase().contains("bank")
        || document_path.to_lowercase().contains("statement")
    {
        "bank_statement"
    } else if subject.to_lowercase().contains("id")
        || document_path.to_lowercase().contains("license")
        || document_path.to_lowercase().contains("passport")
    {
        "id_document"
    } else {
        "other"
    };

    // Insert into documents table
    let now = chrono::Local::now().to_rfc3339();
    conn.execute(
        "INSERT INTO documents (client_id, filename, document_type, file_path, uploaded_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        [
            &client_id.to_string(),
            &subject,
            document_type,
            &document_path,
            &now,
        ],
    )
    .map_err(|e| e.to_string())?;

    let document_id = conn.last_insert_rowid();

    // Log the email import
    conn.execute(
        "INSERT INTO email_imports (client_id, sender_email, subject, document_path, imported_at, processed)
         VALUES (?1, ?2, ?3, ?4, ?5, 1)",
        [
            &client_id.to_string(),
            &sender_email,
            &subject,
            &document_path,
            &now,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(document_id)
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
) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Local::now().to_rfc3339();

    conn.execute(
        "INSERT INTO documents (client_id, filename, document_type, file_path, uploaded_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        [
            &client_id.to_string(),
            &filename,
            &document_type,
            &file_path,
            &now,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
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
        .invoke_handler(tauri::generate_handler![
            get_clients,
            create_client,
            get_bank_policies,
            create_bank_policy,
            get_dashboard_stats,
            save_meeting,
            get_meetings,
            find_client_by_email,
            import_email_document,
            get_recent_email_imports,
            get_client_documents,
            upload_client_document
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

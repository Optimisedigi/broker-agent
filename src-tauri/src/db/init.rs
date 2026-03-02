use rusqlite::{Connection, Result as SqliteResult};

pub fn init_db(conn: &Connection) -> SqliteResult<()> {
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

    // Migration: add source to documents (team vs client)
    let _ = conn.execute("ALTER TABLE documents ADD COLUMN source TEXT DEFAULT 'team'", []);

    // Migration: add meeting_type and external_id to meetings
    let _ = conn.execute("ALTER TABLE meetings ADD COLUMN meeting_type TEXT DEFAULT 'meeting'", []);
    let _ = conn.execute("ALTER TABLE meetings ADD COLUMN external_id TEXT", []);
    let _ = conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_meetings_external_id ON meetings(external_id) WHERE external_id IS NOT NULL", []);
    let _ = conn.execute("ALTER TABLE meetings ADD COLUMN broker_notes TEXT DEFAULT ''", []);

    // Migration: add current loan fields to clients
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN current_lender TEXT DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN current_loan_balance REAL", []);
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN current_interest_rate REAL", []);
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN current_loan_type TEXT DEFAULT ''", []);

    // Migration: add AI summary to clients
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN ai_summary TEXT", []);

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

    conn.execute(
        "CREATE TABLE IF NOT EXISTS app_license (
            id INTEGER PRIMARY KEY,
            license_key TEXT,
            email TEXT,
            expires_at TEXT,
            trial_started_at TEXT NOT NULL,
            activated_at TEXT
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
            "INSERT INTO clients (first_name, last_name, email, phone, income, payg, assets, liabilities, notes, home_address, investment_addresses, properties_viewing, available_deposit, monthly_expenses, goals, client_status, referral_source, pipeline_stage, current_lender, current_loan_balance, current_interest_rate, current_loan_type, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24)",
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
                "ANZ", "720000", "5.99", "Variable",
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

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
        // Insert dummy client: James Chen (existing client)
        conn.execute(
            "INSERT INTO clients (first_name, last_name, email, phone, income, payg, assets, liabilities, notes, home_address, investment_addresses, properties_viewing, available_deposit, monthly_expenses, goals, client_status, referral_source, pipeline_stage, current_lender, current_loan_balance, current_interest_rate, current_loan_type, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24)",
            [
                "James", "Chen",
                "james.chen@email.com", "0423 456 789",
                "220000", "55000", "1800000", "950000",
                "High-income professional. Owns two investment properties, looking to refinance both for better rates.",
                "18 Bronte Rd, Bronte NSW 2024",
                "7/45 Macleay St, Potts Point NSW 2011 | $1,100,000\n22 Cook Rd, Centennial Park NSW 2021 | $1,650,000",
                "",
                "180000", "8200",
                "Year 1: Refinance existing loans to sub-5.5%\nYear 3: Acquire third investment property\nYear 7: Portfolio value exceeding $5M",
                "existing",
                "Word of Mouth",
                "refinance_assessment",
                "Macquarie", "1450000", "6.15", "Variable",
                "2023-06-10T09:00:00+10:00",
                "2026-01-15T11:00:00+11:00",
            ],
        )?;

        let james_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO meetings (client_id, title, recording_path, transcript, summary, meeting_date, duration_seconds, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            [
                &james_id.to_string(),
                "Annual Loan Review - Refinance Options",
                "",
                "",
                "Reviewed James's two investment loans with Macquarie. Combined balance of $1.45M at 6.15% variable. Strong equity position with properties valued at $2.75M total. Discussed CBA and ANZ offerings for investor rates. James wants to lock a portion at fixed for stability.",
                "2026-01-15T11:00:00+11:00",
                "2400",
                "Well-informed client. Wants rate comparison spreadsheet by end of week. Prefers split loan structure.",
            ],
        )?;

        // Insert dummy client: Priya Sharma (existing client)
        conn.execute(
            "INSERT INTO clients (first_name, last_name, email, phone, income, payg, assets, liabilities, notes, home_address, investment_addresses, properties_viewing, available_deposit, monthly_expenses, goals, client_status, referral_source, pipeline_stage, current_lender, current_loan_balance, current_interest_rate, current_loan_type, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24)",
            [
                "Priya", "Sharma",
                "priya.sharma@email.com", "0434 567 890",
                "145000", "32000", "920000", "480000",
                "Purchased first home in 2024, now looking at investment opportunities. Works in tech industry.",
                "5/28 Victoria St, Darlinghurst NSW 2010",
                "12 George St, Marrickville NSW 2204 | $780,000",
                "9 Station St, Newtown NSW 2042",
                "95000", "4800",
                "Year 1: Build equity in current investment\nYear 3: Purchase second investment in inner west\nYear 5: Generate $60K+ passive rental income",
                "existing",
                "Google",
                "complete",
                "Westpac", "620000", "5.49", "Fixed",
                "2024-01-20T10:00:00+11:00",
                "2025-11-10T16:00:00+11:00",
            ],
        )?;

        let priya_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO meetings (client_id, title, recording_path, transcript, summary, meeting_date, duration_seconds, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            [
                &priya_id.to_string(),
                "Investment Property Settlement Review",
                "",
                "",
                "Priya's first investment at 12 George St, Marrickville has settled. Loan of $620K at 5.49% fixed for 3 years with Westpac. Rental appraisal at $650/week. Discussed offset strategy and next steps for building equity before second purchase.",
                "2025-11-10T16:00:00+11:00",
                "1800",
                "Settlement went smoothly. Rental income strong for the area. Set reminder to review fixed rate expiry in 2027.",
            ],
        )?;

        // Insert dummy client: Tom Bradley (new client)
        conn.execute(
            "INSERT INTO clients (first_name, last_name, email, phone, income, payg, assets, liabilities, notes, home_address, investment_addresses, properties_viewing, available_deposit, monthly_expenses, goals, client_status, referral_source, pipeline_stage, current_lender, current_loan_balance, current_interest_rate, current_loan_type, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24)",
            [
                "Tom", "Bradley",
                "tom.bradley@email.com", "0445 678 901",
                "125000", "28000", "350000", "15000",
                "First home buyer referred by real estate agent. Looking to purchase in the Inner West within 3 months.",
                "",
                "",
                "44 Marrickville Rd, Marrickville NSW 2204\n10/88 Enmore Rd, Enmore NSW 2042",
                "110000", "3500",
                "Purchase first home under $900K in Inner West\nMinimise LMI where possible\nSettle before end of financial year",
                "new",
                "Real Estate Agent",
                "financial_assessment",
                "", "0", "0", "",
                "2026-02-28T09:00:00+11:00",
                "2026-02-28T09:00:00+11:00",
            ],
        )?;

        let tom_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO meetings (client_id, title, recording_path, transcript, summary, meeting_date, duration_seconds, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            [
                &tom_id.to_string(),
                "Discovery Call - First Home Purchase",
                "",
                "",
                "Tom is a first home buyer with $110K deposit and household income of $125K. Looking at apartments in Marrickville and Enmore under $900K. Eligible for First Home Buyer Guarantee. Discussed pre-approval timeline and document requirements.",
                "2026-02-28T09:00:00+11:00",
                "2100",
                "Keen buyer, motivated to move quickly. Send document checklist by tomorrow. Check FHBG eligibility with Westpac and CBA.",
            ],
        )?;
    }

    // Seed dummy deals if none exist (updated to include new clients)
    let deal_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM deals", [], |row| row.get(0))
        .unwrap_or(0);

    if deal_count == 0 {
        // Get client IDs
        let sarah_id: i64 = conn
            .query_row("SELECT id FROM clients WHERE first_name = 'Sarah' AND last_name = 'Mitchell'", [], |row| row.get(0))
            .unwrap_or(0);
        let james_id: i64 = conn
            .query_row("SELECT id FROM clients WHERE first_name = 'James' AND last_name = 'Chen'", [], |row| row.get(0))
            .unwrap_or(0);
        let priya_id: i64 = conn
            .query_row("SELECT id FROM clients WHERE first_name = 'Priya' AND last_name = 'Sharma'", [], |row| row.get(0))
            .unwrap_or(0);

        if sarah_id > 0 {
            // Sarah's Deal 1: Bondi investment property
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

            // Sarah's Deal 2: North Sydney unit
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

        if james_id > 0 {
            // James's Deal 1: Potts Point unit
            conn.execute(
                "INSERT INTO deals (client_id, property_address, loan_amount, purchase_date, settlement_date, interest_rate, lender_name, loan_type, status, notes, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                rusqlite::params![
                    james_id, "7/45 Macleay St, Potts Point NSW 2011", 880000.0,
                    "2023-07-20", "2023-09-15", 5.79,
                    "Macquarie", "variable", "active",
                    "First investment property. Used savings for 20% deposit.",
                    "2023-09-15T10:00:00+10:00", "2023-09-15T10:00:00+10:00"
                ],
            )?;

            // James's Deal 2: Centennial Park house
            conn.execute(
                "INSERT INTO deals (client_id, property_address, loan_amount, purchase_date, settlement_date, interest_rate, lender_name, loan_type, status, notes, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                rusqlite::params![
                    james_id, "22 Cook Rd, Centennial Park NSW 2021", 1320000.0,
                    "2024-03-10", "2024-05-20", 6.15,
                    "Macquarie", "variable", "active",
                    "Second investment property. Leveraged equity from Potts Point.",
                    "2024-05-20T14:00:00+10:00", "2024-05-20T14:00:00+10:00"
                ],
            )?;

            // James's Deal 3: Looking to refinance (pending)
            conn.execute(
                "INSERT INTO deals (client_id, property_address, loan_amount, purchase_date, settlement_date, interest_rate, lender_name, loan_type, status, notes, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                rusqlite::params![
                    james_id, "Refinance - Combined Portfolio", 1450000.0,
                    "", "", 0.0,
                    "", "variable", "pending",
                    "Refinance both investment loans. Targeting sub-5.5% rate with CBA or ANZ.",
                    "2026-01-15T11:00:00+11:00", "2026-01-15T11:00:00+11:00"
                ],
            )?;
        }

        if priya_id > 0 {
            // Priya's Deal 1: Marrickville investment
            conn.execute(
                "INSERT INTO deals (client_id, property_address, loan_amount, purchase_date, settlement_date, interest_rate, lender_name, loan_type, status, notes, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                rusqlite::params![
                    priya_id, "12 George St, Marrickville NSW 2204", 620000.0,
                    "2025-08-15", "2025-11-10", 5.49,
                    "Westpac", "fixed", "settled",
                    "First investment property. 3-year fixed rate. Rental appraisal $650/week.",
                    "2025-11-10T16:00:00+11:00", "2025-11-10T16:00:00+11:00"
                ],
            )?;
        }
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

    Ok(())
}

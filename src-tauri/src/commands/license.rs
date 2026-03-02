use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use chrono::{Local, NaiveDate};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::State;

use crate::AppState;

const HMAC_SECRET: &[u8] = b"ba-crm-license-key-s3cret-2026";
const TRIAL_DAYS: i64 = 30;
const KEY_PREFIX: &str = "BA-v1.";

#[derive(Serialize, Deserialize)]
struct KeyPayload {
    email: String,
    exp: String,
    iat: String,
}

fn hmac_sha256(secret: &[u8], message: &[u8]) -> Vec<u8> {
    let block_size = 64;
    let key = if secret.len() > block_size {
        let mut hasher = Sha256::new();
        hasher.update(secret);
        hasher.finalize().to_vec()
    } else {
        secret.to_vec()
    };

    let mut ipad = vec![0x36u8; block_size];
    let mut opad = vec![0x5cu8; block_size];
    for i in 0..key.len() {
        ipad[i] ^= key[i];
        opad[i] ^= key[i];
    }

    let mut inner = Sha256::new();
    inner.update(&ipad);
    inner.update(message);
    let inner_hash = inner.finalize();

    let mut outer = Sha256::new();
    outer.update(&opad);
    outer.update(inner_hash);
    outer.finalize().to_vec()
}

fn verify_license_key(key: &str) -> Result<KeyPayload, String> {
    let stripped = key
        .strip_prefix(KEY_PREFIX)
        .ok_or("Invalid key format: missing prefix")?;

    let parts: Vec<&str> = stripped.splitn(2, '.').collect();
    if parts.len() != 2 {
        return Err("Invalid key format: missing signature".into());
    }

    let payload_b64 = parts[0];
    let sig_b64 = parts[1];

    let payload_bytes = URL_SAFE_NO_PAD
        .decode(payload_b64)
        .map_err(|_| "Invalid key: bad payload encoding")?;

    let sig_bytes = URL_SAFE_NO_PAD
        .decode(sig_b64)
        .map_err(|_| "Invalid key: bad signature encoding")?;

    let expected_sig = hmac_sha256(HMAC_SECRET, &payload_bytes);
    if sig_bytes != expected_sig {
        return Err("Invalid license key: signature mismatch".into());
    }

    let payload: KeyPayload =
        serde_json::from_slice(&payload_bytes).map_err(|_| "Invalid key: bad payload")?;

    let exp_date = NaiveDate::parse_from_str(&payload.exp, "%Y-%m-%d")
        .map_err(|_| "Invalid key: bad expiry date")?;
    let today = Local::now().date_naive();
    if exp_date < today {
        return Err("License key has expired".into());
    }

    Ok(payload)
}

#[derive(Serialize)]
pub struct LicenseStatus {
    pub state: String,
    pub days_remaining: i64,
    pub email: Option<String>,
}

#[tauri::command]
pub fn get_license_status(state: State<AppState>) -> Result<LicenseStatus, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let row_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM app_license", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    if row_count == 0 {
        // First launch: create trial row
        let now = Local::now().to_rfc3339();
        conn.execute(
            "INSERT INTO app_license (trial_started_at) VALUES (?1)",
            [&now],
        )
        .map_err(|e| e.to_string())?;

        return Ok(LicenseStatus {
            state: "trial".into(),
            days_remaining: TRIAL_DAYS,
            email: None,
        });
    }

    let (license_key, email, expires_at, trial_started_at): (
        Option<String>,
        Option<String>,
        Option<String>,
        String,
    ) = conn
        .query_row(
            "SELECT license_key, email, expires_at, trial_started_at FROM app_license WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|e| e.to_string())?;

    let today = Local::now().date_naive();

    // If there's an active license, check it
    if let (Some(ref key), Some(ref _email), Some(ref exp)) = (&license_key, &email, &expires_at) {
        let exp_date = NaiveDate::parse_from_str(exp, "%Y-%m-%d")
            .or_else(|_| {
                chrono::DateTime::parse_from_rfc3339(exp)
                    .map(|dt| dt.date_naive())
            })
            .map_err(|_| "Invalid expiry date in database")?;

        let days = (exp_date - today).num_days();

        // Re-validate signature on every launch
        if verify_license_key(key).is_err() {
            return Ok(LicenseStatus {
                state: "expired_license".into(),
                days_remaining: 0,
                email: email.clone(),
            });
        }

        if days < 0 {
            return Ok(LicenseStatus {
                state: "expired_license".into(),
                days_remaining: 0,
                email: email.clone(),
            });
        }

        return Ok(LicenseStatus {
            state: "active".into(),
            days_remaining: days,
            email: email.clone(),
        });
    }

    // Trial mode
    let trial_start = chrono::DateTime::parse_from_rfc3339(&trial_started_at)
        .map(|dt| dt.date_naive())
        .map_err(|_| "Invalid trial start date")?;

    let trial_days_elapsed = (today - trial_start).num_days();
    let days_remaining = TRIAL_DAYS - trial_days_elapsed;

    if days_remaining <= 0 {
        Ok(LicenseStatus {
            state: "expired_trial".into(),
            days_remaining: 0,
            email: None,
        })
    } else {
        Ok(LicenseStatus {
            state: "trial".into(),
            days_remaining,
            email: None,
        })
    }
}

#[tauri::command]
pub fn activate_license(state: State<AppState>, key: String) -> Result<LicenseStatus, String> {
    let payload = verify_license_key(&key)?;

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let now = Local::now().to_rfc3339();

    conn.execute(
        "UPDATE app_license SET license_key = ?1, email = ?2, expires_at = ?3, activated_at = ?4 WHERE id = 1",
        [&key, &payload.email, &payload.exp, &now],
    )
    .map_err(|e| e.to_string())?;

    let exp_date = NaiveDate::parse_from_str(&payload.exp, "%Y-%m-%d")
        .map_err(|_| "Bad expiry")?;
    let days = (exp_date - Local::now().date_naive()).num_days();

    Ok(LicenseStatus {
        state: "active".into(),
        days_remaining: days,
        email: Some(payload.email),
    })
}

#[tauri::command]
pub fn deactivate_license(state: State<AppState>) -> Result<LicenseStatus, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE app_license SET license_key = NULL, email = NULL, expires_at = NULL, activated_at = NULL WHERE id = 1",
        [],
    )
    .map_err(|e| e.to_string())?;

    // Return current trial status
    let trial_started_at: String = conn
        .query_row(
            "SELECT trial_started_at FROM app_license WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let today = Local::now().date_naive();
    let trial_start = chrono::DateTime::parse_from_rfc3339(&trial_started_at)
        .map(|dt| dt.date_naive())
        .map_err(|_| "Invalid trial start date")?;

    let days_remaining = TRIAL_DAYS - (today - trial_start).num_days();

    if days_remaining <= 0 {
        Ok(LicenseStatus {
            state: "expired_trial".into(),
            days_remaining: 0,
            email: None,
        })
    } else {
        Ok(LicenseStatus {
            state: "trial".into(),
            days_remaining,
            email: None,
        })
    }
}

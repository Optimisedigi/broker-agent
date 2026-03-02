use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::atomic::AtomicBool;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
}

pub struct RecordingState {
    pub is_recording: AtomicBool,
    pub samples: Mutex<Vec<f32>>,
    pub sample_rate: Mutex<u32>,
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
    pub current_lender: Option<String>,
    pub current_loan_balance: Option<f64>,
    pub current_interest_rate: Option<f64>,
    pub current_loan_type: Option<String>,
    pub ai_summary: Option<String>,
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
    pub source: Option<String>,
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
    pub meeting_type: Option<String>,
    pub external_id: Option<String>,
    pub broker_notes: Option<String>,
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

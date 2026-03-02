mod commands;
mod db;
mod error;
mod oauth;

// Re-export for oauth.rs compatibility (it uses `crate::AppState` and `crate::do_import_email_document`)
pub use db::{do_import_email_document, AppState, RecordingState};

use std::sync::atomic::AtomicBool;
use std::sync::Mutex;

use db::init_db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = dirs::data_dir()
        .expect("Failed to get data directory")
        .join("BrokerageCRM")
        .join("database.db");

    std::fs::create_dir_all(db_path.parent().unwrap()).expect("Failed to create app directory");

    let conn = rusqlite::Connection::open(&db_path).expect("Failed to open database");
    init_db(&conn).expect("Failed to initialize database");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            db: Mutex::new(conn),
        })
        .manage(RecordingState {
            is_recording: AtomicBool::new(false),
            samples: Mutex::new(Vec::new()),
            sample_rate: Mutex::new(0),
        })
        .invoke_handler(tauri::generate_handler![
            commands::clients::get_clients,
            commands::clients::create_client,
            commands::clients::update_client,
            commands::clients::delete_client,
            commands::clients::find_client_by_email,
            commands::clients::update_client_status,
            commands::documents::get_client_documents,
            commands::documents::upload_client_document,
            commands::documents::get_document_data,
            commands::documents::open_file,
            commands::documents::rename_document,
            commands::documents::delete_document,
            commands::meetings::save_meeting,
            commands::meetings::get_meetings,
            commands::meetings::get_client_meetings,
            commands::meetings::update_meeting_notes,
            commands::policies::get_bank_policies,
            commands::policies::create_bank_policy,
            commands::deals::get_client_deals,
            commands::deals::create_deal,
            commands::deals::get_deal_events,
            commands::deals::create_deal_event,
            commands::dashboard::get_dashboard_stats,
            commands::dashboard::get_referral_stats,
            commands::emails::import_email_document,
            commands::emails::get_recent_email_imports,
            commands::broker::get_broker_profile,
            commands::broker::save_broker_profile,
            commands::recording::start_recording,
            commands::recording::stop_recording,
            commands::recording::check_whisper_model,
            commands::recording::get_whisper_model_status,
            commands::recording::download_whisper_model,
            commands::recording::transcribe_audio,
            commands::ai::generate_meeting_summary,
            commands::ai::generate_client_summary,
            oauth::start_oauth,
            oauth::check_oauth_status,
            oauth::disconnect_oauth,
            oauth::sync_emails,
            oauth::create_calendar_event,
            oauth::get_upcoming_meetings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

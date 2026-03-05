use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::Rng;
use reqwest::Client as HttpClient;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::{BufRead, BufReader, Write};
use tauri::State;
use tokio::net::TcpListener;

use crate::AppState;

// ---------------------------------------------------------------------------
// HTML stripping helper
// ---------------------------------------------------------------------------

fn strip_html_to_text(html: &str) -> String {
    // Remove style and script blocks entirely
    let re_style = regex::Regex::new(r"(?is)<style[^>]*>.*?</style>").unwrap();
    let text = re_style.replace_all(html, "");
    let re_script = regex::Regex::new(r"(?is)<script[^>]*>.*?</script>").unwrap();
    let text = re_script.replace_all(&text, "");

    // Replace <br>, <p>, <div>, <tr>, <li> with newlines
    let re_block = regex::Regex::new(r"(?i)<(br|/p|/div|/tr|/li|/h[1-6])[^>]*>").unwrap();
    let text = re_block.replace_all(&text, "\n");

    // Remove all remaining HTML tags
    let re_tags = regex::Regex::new(r"<[^>]+>").unwrap();
    let text = re_tags.replace_all(&text, "");

    // Decode common HTML entities
    let text = text
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&nbsp;", " ")
        .replace("&#160;", " ");

    // Collapse multiple whitespace/newlines
    let re_spaces = regex::Regex::new(r"[ \t]+").unwrap();
    let text = re_spaces.replace_all(&text, " ");
    let re_newlines = regex::Regex::new(r"\n{3,}").unwrap();
    let text = re_newlines.replace_all(&text, "\n\n");

    text.trim().to_string()
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Replace these with your real OAuth client IDs
const GOOGLE_CLIENT_ID: &str = "706581607048-l3vj1b0gg3v7gt2b7ge5300dd76f92rf.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET: &str = "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";
const MICROSOFT_CLIENT_ID: &str = "e01aaedb-6e8b-4bbf-8220-a512eaed8956";
const MICROSOFT_CLIENT_SECRET: &str = "Sew8Q~HuaU89VSqI18KBuk7Z2RdVa_qRirNdYa0a";

const REDIRECT_URI: &str = "http://localhost:9876/callback";

const GOOGLE_AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL: &str = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_SCOPES: &str = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email";

const MICROSOFT_AUTH_URL: &str = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MICROSOFT_TOKEN_URL: &str = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const MICROSOFT_SCOPES: &str = "Mail.Read Calendars.ReadWrite offline_access User.Read";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OAuthStatus {
    pub connected: bool,
    pub provider: String,
    pub account_email: Option<String>,
    pub last_sync_at: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CalendarEvent {
    pub title: String,
    pub start_time: String,
    pub end_time: String,
    pub attendee_email: Option<String>,
    pub description: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SyncResult {
    pub imported_count: usize,
    pub documents: Vec<String>,
    pub email_count: usize,
    pub document_count: usize,
}

#[derive(Debug, Clone)]
struct SyncedEmail {
    sender: String,
    subject: String,
    attachment_paths: Vec<String>,
    body: Option<String>,
    received_at: Option<String>,
    message_id: String,
}

#[derive(Deserialize, Debug)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: u64,
    #[serde(default)]
    token_type: String,
}

#[derive(Deserialize, Debug)]
struct GoogleUserInfo {
    email: String,
}

#[derive(Deserialize, Debug)]
struct MicrosoftUserInfo {
    #[serde(rename = "mail", default)]
    mail: Option<String>,
    #[serde(rename = "userPrincipalName", default)]
    user_principal_name: Option<String>,
}

// Gmail API types
#[derive(Deserialize, Debug)]
struct GmailMessageList {
    messages: Option<Vec<GmailMessageRef>>,
}

#[derive(Deserialize, Debug)]
struct GmailMessageRef {
    id: String,
}

#[derive(Deserialize, Debug)]
struct GmailMessage {
    id: String,
    payload: Option<GmailPayload>,
}

#[derive(Deserialize, Debug)]
struct GmailPayload {
    headers: Option<Vec<GmailHeader>>,
    parts: Option<Vec<GmailPart>>,
    body: Option<GmailBody>,
    #[serde(rename = "mimeType")]
    mime_type: Option<String>,
}

#[derive(Deserialize, Debug)]
struct GmailHeader {
    name: String,
    value: String,
}

#[derive(Deserialize, Debug)]
struct GmailPart {
    filename: Option<String>,
    #[serde(rename = "mimeType")]
    mime_type: Option<String>,
    body: Option<GmailBody>,
}

#[derive(Deserialize, Debug)]
struct GmailBody {
    #[serde(rename = "attachmentId")]
    attachment_id: Option<String>,
    data: Option<String>,
    size: Option<u64>,
}

#[derive(Deserialize, Debug)]
struct GmailAttachment {
    data: String,
}

// Microsoft Graph types
#[derive(Deserialize, Debug)]
struct GraphMessageList {
    value: Vec<GraphMessage>,
}

#[derive(Deserialize, Debug)]
struct GraphMessage {
    id: String,
    subject: Option<String>,
    from: Option<GraphFrom>,
    body: Option<GraphBody>,
    #[serde(rename = "receivedDateTime", default)]
    received_date_time: Option<String>,
    #[serde(rename = "hasAttachments", default)]
    has_attachments: bool,
}

#[derive(Deserialize, Debug)]
struct GraphBody {
    content: Option<String>,
    #[serde(rename = "contentType", default)]
    content_type: Option<String>,
}

#[derive(Deserialize, Debug)]
struct GraphFrom {
    #[serde(rename = "emailAddress")]
    email_address: GraphEmailAddress,
}

#[derive(Deserialize, Debug)]
struct GraphEmailAddress {
    address: String,
}

#[derive(Deserialize, Debug)]
struct GraphAttachmentList {
    value: Vec<GraphAttachment>,
}

#[derive(Deserialize, Debug)]
struct GraphAttachment {
    #[serde(rename = "@odata.type", default)]
    odata_type: Option<String>,
    name: Option<String>,
    #[serde(rename = "contentBytes", default)]
    content_bytes: Option<String>,
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

pub(crate) fn generate_pkce() -> (String, String) {
    let mut rng = rand::thread_rng();
    let verifier: String = (0..64)
        .map(|_| {
            let idx = rng.gen_range(0..62);
            let chars = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            chars[idx] as char
        })
        .collect();

    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let challenge = URL_SAFE_NO_PAD.encode(hasher.finalize());

    (verifier, challenge)
}

// ---------------------------------------------------------------------------
// Local callback server — waits for the OAuth redirect
// ---------------------------------------------------------------------------

async fn wait_for_callback() -> Result<String, String> {
    let listener = TcpListener::bind("127.0.0.1:9876")
        .await
        .map_err(|e| format!("Failed to bind callback server: {}", e))?;

    // Loop to handle multiple requests (favicon, preflight, etc.)
    // until we get one with an auth code
    let deadline = tokio::time::Instant::now() + tokio::time::Duration::from_secs(120);
    loop {
        let accept_result = tokio::time::timeout_at(deadline, listener.accept()).await;
        let (stream, _) = match accept_result {
            Ok(Ok(conn)) => conn,
            Ok(Err(e)) => {
                eprintln!("[OAuth] Accept error: {}, retrying...", e);
                continue;
            }
            Err(_) => return Err("OAuth callback timed out after 120 seconds".to_string()),
        };

        // Convert to std for synchronous line reading
        let std_stream = stream
            .into_std()
            .map_err(|e| format!("Failed to convert stream: {}", e))?;
        std_stream
            .set_nonblocking(false)
            .map_err(|e| format!("Failed to set blocking: {}", e))?;

        let mut reader = BufReader::new(&std_stream);
        let mut request_line = String::new();
        if reader.read_line(&mut request_line).is_err() {
            continue;
        }

        eprintln!("[OAuth] Callback request: {}", request_line.trim());

        // Try to parse auth code from GET /callback?code=...
        let code = request_line
            .split_whitespace()
            .nth(1)
            .and_then(|path| url::Url::parse(&format!("http://localhost{}", path)).ok())
            .and_then(|url| {
                url.query_pairs()
                    .find(|(k, _)| k == "code")
                    .map(|(_, v)| v.to_string())
            });

        if let Some(code) = code {
            // Got the auth code, send success response and return
            let response_body = "<html><body><h2>Connected!</h2><p>You can close this window and return to Broker Agent.</p></body></html>";
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                response_body.len(),
                response_body
            );
            let mut writer = &std_stream;
            let _ = writer.write_all(response.as_bytes());
            let _ = writer.flush();
            return Ok(code);
        }

        // Not the auth code request, send a minimal response and keep waiting
        let empty_response = "HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
        let mut writer = &std_stream;
        let _ = writer.write_all(empty_response.as_bytes());
        let _ = writer.flush();
    }
}

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

async fn get_valid_token(
    state: &State<'_, AppState>,
    provider: &str,
) -> Result<String, String> {
    // Read token info (short lock, released before await)
    let (access_token, refresh_token, expires_at) = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT access_token, refresh_token, expires_at FROM oauth_tokens WHERE provider = ?1",
            [provider],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .map_err(|_| format!("No token for {}", provider))?
    };

    // Check if token is still valid (5 min buffer)
    let expires =
        chrono::DateTime::parse_from_rfc3339(&expires_at).map_err(|e| e.to_string())?;
    let now = chrono::Utc::now();
    let buffer = chrono::Duration::minutes(5);

    if now + buffer < expires {
        return Ok(access_token);
    }

    // Token expired — refresh using async HTTP (no lock held)
    let refresh_token = refresh_token.ok_or("No refresh token available")?;

    let (token_url, client_id) = match provider {
        "google" => (GOOGLE_TOKEN_URL, GOOGLE_CLIENT_ID),
        "microsoft" => (MICROSOFT_TOKEN_URL, MICROSOFT_CLIENT_ID),
        _ => return Err("Unknown provider".to_string()),
    };

    let http = HttpClient::new();
    let mut form_params: Vec<(&str, &str)> = vec![
        ("client_id", client_id),
        ("refresh_token", &refresh_token),
        ("grant_type", "refresh_token"),
    ];
    if provider == "google" {
        form_params.push(("client_secret", GOOGLE_CLIENT_SECRET));
    } else if provider == "microsoft" {
        form_params.push(("client_secret", MICROSOFT_CLIENT_SECRET));
    }

    let resp = http
        .post(token_url)
        .form(&form_params)
        .send()
        .await
        .map_err(|e| format!("Refresh request failed: {}", e))?;

    let token_resp: TokenResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse refresh response: {}", e))?;

    let new_expires = chrono::Utc::now()
        + chrono::Duration::seconds(token_resp.expires_in as i64);
    let now_str = chrono::Local::now().to_rfc3339();

    // Update DB (short lock)
    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE oauth_tokens SET access_token = ?1, expires_at = ?2, updated_at = ?3 WHERE provider = ?4",
            rusqlite::params![
                token_resp.access_token,
                new_expires.to_rfc3339(),
                now_str,
                provider,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(token_resp.access_token)
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn start_oauth(
    state: State<'_, AppState>,
    provider: String,
) -> Result<OAuthStatus, String> {
    let (verifier, challenge) = generate_pkce();

    let (auth_url_base, client_id, scopes) = match provider.as_str() {
        "google" => (GOOGLE_AUTH_URL, GOOGLE_CLIENT_ID, GOOGLE_SCOPES),
        "microsoft" => (MICROSOFT_AUTH_URL, MICROSOFT_CLIENT_ID, MICROSOFT_SCOPES),
        _ => return Err("Unknown provider".to_string()),
    };

    let mut auth_url = url::Url::parse(auth_url_base).map_err(|e| e.to_string())?;
    auth_url.query_pairs_mut()
        .append_pair("client_id", client_id)
        .append_pair("redirect_uri", REDIRECT_URI)
        .append_pair("response_type", "code")
        .append_pair("scope", scopes)
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("prompt", "consent");

    if provider == "google" {
        auth_url.query_pairs_mut()
            .append_pair("access_type", "offline");
    }

    // Open browser
    eprintln!("[OAuth] Opening browser for {} auth", provider);
    open::that(auth_url.as_str()).map_err(|e| format!("Failed to open browser: {}", e))?;

    // Wait for callback
    eprintln!("[OAuth] Waiting for callback on port 9876...");
    let code = wait_for_callback().await?;
    eprintln!("[OAuth] Got auth code: {}...", &code[..code.len().min(10)]);

    // Exchange code for tokens
    let (token_url, token_client_id) = match provider.as_str() {
        "google" => (GOOGLE_TOKEN_URL, GOOGLE_CLIENT_ID),
        "microsoft" => (MICROSOFT_TOKEN_URL, MICROSOFT_CLIENT_ID),
        _ => return Err("Unknown provider".to_string()),
    };

    let http = HttpClient::new();
    let mut form_params: Vec<(&str, &str)> = vec![
        ("client_id", token_client_id),
        ("code", code.as_str()),
        ("redirect_uri", REDIRECT_URI),
        ("grant_type", "authorization_code"),
        ("code_verifier", verifier.as_str()),
    ];
    if provider == "google" {
        form_params.push(("client_secret", GOOGLE_CLIENT_SECRET));
    } else if provider == "microsoft" {
        form_params.push(("client_secret", MICROSOFT_CLIENT_SECRET));
    }
    let resp = http
        .post(token_url)
        .form(&form_params)
        .send()
        .await
        .map_err(|e| format!("Token exchange failed: {}", e))?;

    let resp_text = resp.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
    eprintln!("[OAuth] Token response: {}", &resp_text[..resp_text.len().min(500)]);

    if resp_text.contains("\"error\"") {
        return Err(format!("OAuth token error: {}", resp_text));
    }

    let token_resp: TokenResponse = serde_json::from_str(&resp_text)
        .map_err(|e| format!("Failed to parse token response: {}", e))?;

    // Fetch account email
    let account_email = match provider.as_str() {
        "google" => {
            let resp_text = http
                .get(GOOGLE_USERINFO_URL)
                .bearer_auth(&token_resp.access_token)
                .send()
                .await
                .map_err(|e| format!("Google userinfo request failed: {}", e))?
                .text()
                .await
                .map_err(|e| format!("Failed to read userinfo response: {}", e))?;
            eprintln!("[OAuth] Google userinfo response: {}", &resp_text[..resp_text.len().min(500)]);
            let info: GoogleUserInfo = serde_json::from_str(&resp_text)
                .map_err(|e| format!("Failed to parse userinfo: {}", e))?;
            info.email
        }
        "microsoft" => {
            let resp_text = http
                .get("https://graph.microsoft.com/v1.0/me")
                .bearer_auth(&token_resp.access_token)
                .send()
                .await
                .map_err(|e| format!("Microsoft userinfo request failed: {}", e))?
                .text()
                .await
                .map_err(|e| format!("Failed to read userinfo response: {}", e))?;
            eprintln!("[OAuth] Microsoft userinfo response: {}", &resp_text[..resp_text.len().min(500)]);
            let info: MicrosoftUserInfo = serde_json::from_str(&resp_text)
                .map_err(|e| format!("Failed to parse userinfo: {}", e))?;
            info.mail.or(info.user_principal_name).unwrap_or_default()
        }
        _ => String::new(),
    };

    let now = chrono::Local::now().to_rfc3339();
    let expires_at = (chrono::Utc::now()
        + chrono::Duration::seconds(token_resp.expires_in as i64))
    .to_rfc3339();

    // Store tokens — release lock before returning
    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO oauth_tokens (provider, access_token, refresh_token, expires_at, account_email, scopes, last_sync_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7, ?8)",
            rusqlite::params![
                provider,
                token_resp.access_token,
                token_resp.refresh_token,
                expires_at,
                account_email,
                match provider.as_str() {
                    "google" => GOOGLE_SCOPES,
                    "microsoft" => MICROSOFT_SCOPES,
                    _ => "",
                },
                now,
                now,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(OAuthStatus {
        connected: true,
        provider,
        account_email: Some(account_email),
        last_sync_at: None,
    })
}

#[tauri::command]
pub fn check_oauth_status(
    state: State<'_, AppState>,
    provider: String,
) -> Result<OAuthStatus, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let result = conn.query_row(
        "SELECT account_email, last_sync_at FROM oauth_tokens WHERE provider = ?1",
        [&provider],
        |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<String>>(1)?,
            ))
        },
    );

    match result {
        Ok((email, last_sync)) => Ok(OAuthStatus {
            connected: true,
            provider,
            account_email: email,
            last_sync_at: last_sync,
        }),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(OAuthStatus {
            connected: false,
            provider,
            account_email: None,
            last_sync_at: None,
        }),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn disconnect_oauth(
    state: State<'_, AppState>,
    provider: String,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM oauth_tokens WHERE provider = ?1",
        [&provider],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn sync_emails(
    state: State<'_, AppState>,
    provider: String,
) -> Result<SyncResult, String> {
    // Get valid token (may refresh via HTTP, no lock held during await)
    let access_token = get_valid_token(&state, &provider).await?;

    // Gather needed data while holding the lock, then release
    let (client_emails, last_sync_at) = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare("SELECT email FROM clients WHERE email IS NOT NULL AND email != ''")
            .map_err(|e| e.to_string())?;
        let emails: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(0).map(|s| s.trim().to_string()))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .filter(|e| !e.is_empty())
            .collect();

        let last_sync: Option<String> = conn
            .query_row(
                "SELECT last_sync_at FROM oauth_tokens WHERE provider = ?1",
                [&provider],
                |row| row.get(0),
            )
            .ok()
            .flatten();

        (emails, last_sync)
    };

    if client_emails.is_empty() {
        return Ok(SyncResult {
            imported_count: 0,
            documents: vec![],
            email_count: 0,
            document_count: 0,
        });
    }

    // Create email imports directory
    let import_dir = dirs::document_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default().join("Documents"))
        .join("BrokerAgent")
        .join("email_imports");
    std::fs::create_dir_all(&import_dir)
        .map_err(|e| format!("Failed to create import dir: {}", e))?;

    let http = HttpClient::new();
    let synced_emails: Vec<SyncedEmail> = match provider.as_str() {
        "google" => {
            sync_gmail(&http, &access_token, &client_emails, &import_dir, &last_sync_at).await?
        }
        "microsoft" => {
            sync_outlook(&http, &access_token, &client_emails, &import_dir, &last_sync_at).await?
        }
        _ => return Err("Unknown provider".to_string()),
    };

    // Import documents and create email meeting records
    let mut doc_names: Vec<String> = Vec::new();
    // Collect (meeting_id, plain_text) for AI summary generation after lock release
    let mut new_email_meetings: Vec<(i64, String)> = Vec::new();

    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        for email in &synced_emails {
            // Skip if this email was already synced (dedup by external_id/message_id)
            if !email.message_id.is_empty() {
                let already_synced: bool = conn
                    .query_row(
                        "SELECT COUNT(*) FROM meetings WHERE external_id = ?1",
                        [&email.message_id],
                        |row| row.get::<_, i64>(0),
                    )
                    .unwrap_or(0) > 0;
                if already_synced {
                    continue;
                }
            }

            // Import attachments
            for path in &email.attachment_paths {
                if let Err(e) = crate::do_import_email_document(&conn, &email.sender, &email.subject, path) {
                    eprintln!("[Sync] Failed to import document from {}: {}", email.sender, e);
                } else {
                    let fname = std::path::Path::new(path)
                        .file_name()
                        .map(|f| f.to_string_lossy().to_string())
                        .unwrap_or_else(|| email.subject.clone());
                    doc_names.push(fname);
                }
            }

            // Create email meeting record (dedup by external_id)
            if !email.message_id.is_empty() {
                let exists: bool = conn
                    .query_row(
                        "SELECT COUNT(*) FROM meetings WHERE external_id = ?1",
                        [&email.message_id],
                        |row| row.get::<_, i64>(0),
                    )
                    .unwrap_or(0) > 0;

                if !exists {
                    // Find client by email (case-insensitive)
                    let client_id: Option<i64> = conn
                        .query_row(
                            "SELECT id FROM clients WHERE LOWER(email) = LOWER(?1)",
                            [&email.sender],
                            |row| row.get(0),
                        )
                        .ok();

                    if let Some(cid) = client_id {
                        let meeting_date = email.received_at.clone().unwrap_or_else(|| chrono::Local::now().to_rfc3339());

                        // Strip HTML from email body to plain text
                        let mut plain_text = match &email.body {
                            Some(b) => strip_html_to_text(b),
                            None => String::new(),
                        };

                        // Append attachment filenames if any
                        if !email.attachment_paths.is_empty() {
                            let filenames: Vec<String> = email.attachment_paths.iter()
                                .filter_map(|p| std::path::Path::new(p).file_name().map(|f| f.to_string_lossy().to_string()))
                                .collect();
                            plain_text.push_str(&format!(
                                "\n\nAttachments ({}): {}",
                                filenames.len(),
                                filenames.join(", ")
                            ));
                        }

                        // Insert with plain text in notes, summary will be filled by AI
                        if let Err(e) = conn.execute(
                            "INSERT INTO meetings (client_id, title, recording_path, transcript, summary, meeting_date, duration_seconds, notes, meeting_type, external_id)
                             VALUES (?1, ?2, '', '', '', ?3, NULL, ?4, 'email', ?5)",
                            rusqlite::params![
                                cid,
                                email.subject,
                                meeting_date,
                                plain_text,
                                email.message_id,
                            ],
                        ) {
                            eprintln!("[Sync] Failed to create email meeting record: {}", e);
                        } else {
                            let meeting_id = conn.last_insert_rowid();
                            new_email_meetings.push((meeting_id, plain_text.clone()));
                        }
                    }
                }
            }
        }

        // Repair: create email meeting records for any email_imports without corresponding meetings
        let mut repair_stmt = conn
            .prepare(
                "SELECT ei.client_id, ei.subject, ei.imported_at, ei.sender_email
                 FROM email_imports ei
                 WHERE NOT EXISTS (
                     SELECT 1 FROM meetings m
                     WHERE m.client_id = ei.client_id AND m.meeting_type = 'email' AND m.title = ei.subject
                 )
                 GROUP BY ei.client_id, ei.subject",
            )
            .map_err(|e| e.to_string())?;

        let repairs: Vec<(i64, String, String, String)> = repair_stmt
            .query_map([], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        for (cid, subject, imported_at, _sender) in &repairs {
            if let Err(e) = conn.execute(
                "INSERT INTO meetings (client_id, title, recording_path, transcript, summary, meeting_date, duration_seconds, notes, meeting_type)
                 VALUES (?1, ?2, '', '', '', ?3, NULL, '', 'email')",
                rusqlite::params![cid, subject, imported_at],
            ) {
                eprintln!("[Sync] Failed to repair email meeting record: {}", e);
            }
        }

        // Update last_sync_at
        let now = chrono::Local::now().to_rfc3339();
        conn.execute(
            "UPDATE oauth_tokens SET last_sync_at = ?1, updated_at = ?2 WHERE provider = ?3",
            rusqlite::params![now, now, provider],
        )
        .map_err(|e| e.to_string())?;
    }
    // Lock released - now generate AI summaries for new emails (async-safe)
    for (meeting_id, plain_text) in &new_email_meetings {
        if plain_text.trim().is_empty() {
            continue;
        }

        let system_prompt = "You are an AI assistant for a mortgage broker. Write a 1-3 line summary of this email so the broker can skip reading it. \
            Extract: what the client wants or is providing, any dollar figures or rates mentioned, and what documents are attached. \
            Be direct and specific. No filler. Use plain text, not markdown.";

        match crate::commands::ai::call_moonshot(system_prompt, plain_text).await {
            Ok(summary) => {
                let conn = state.db.lock().map_err(|e| e.to_string())?;
                if let Err(e) = conn.execute(
                    "UPDATE meetings SET summary = ?1 WHERE id = ?2",
                    rusqlite::params![summary, meeting_id],
                ) {
                    eprintln!("[Sync] Failed to save AI email summary: {}", e);
                }
            }
            Err(e) => {
                eprintln!("[Sync] AI summary failed for meeting {}: {}", meeting_id, e);
                // Fallback: use the plain text as the summary
                let conn = state.db.lock().map_err(|e| e.to_string())?;
                if let Err(e2) = conn.execute(
                    "UPDATE meetings SET summary = ?1 WHERE id = ?2",
                    rusqlite::params![plain_text, meeting_id],
                ) {
                    eprintln!("[Sync] Failed to save fallback summary: {}", e2);
                }
            }
        }
    }

    Ok(SyncResult {
        imported_count: doc_names.len(),
        email_count: new_email_meetings.len(),
        document_count: doc_names.len(),
        documents: doc_names,
    })
}

#[tauri::command]
pub async fn create_calendar_event(
    state: State<'_, AppState>,
    provider: String,
    event: CalendarEvent,
) -> Result<String, String> {
    let access_token = get_valid_token(&state, &provider).await?;

    let http = HttpClient::new();

    match provider.as_str() {
        "google" => create_google_event(&http, &access_token, &event).await,
        "microsoft" => create_microsoft_event(&http, &access_token, &event).await,
        _ => Err("Unknown provider".to_string()),
    }
}

// ---------------------------------------------------------------------------
// Gmail sync
// ---------------------------------------------------------------------------

async fn sync_gmail(
    http: &HttpClient,
    token: &str,
    client_emails: &[String],
    import_dir: &std::path::Path,
    last_sync_at: &Option<String>,
) -> Result<Vec<SyncedEmail>, String> {
    let mut imported = Vec::new();

    // Build query - search for emails both FROM and TO client addresses
    let email_query: Vec<String> = client_emails
        .iter()
        .flat_map(|e| vec![format!("from:{}", e), format!("to:{}", e)])
        .collect();
    let mut query = format!("({})", email_query.join(" OR "));

    if let Some(ref since) = last_sync_at {
        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(since) {
            query.push_str(&format!(" after:{}", dt.format("%Y/%m/%d")));
        }
    }

    let list_url = format!(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?q={}&maxResults=50",
        urlencoding::encode(&query)
    );

    let resp = http
        .get(&list_url)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("Gmail list failed: {}", e))?;

    let list: GmailMessageList = resp.json().await.map_err(|e| e.to_string())?;

    let messages = match list.messages {
        Some(msgs) => msgs,
        None => return Ok(imported),
    };

    for msg_ref in messages.iter().take(20) {
        let msg_url = format!(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/{}",
            msg_ref.id
        );
        let msg_resp = http
            .get(&msg_url)
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let msg: GmailMessage = msg_resp.json().await.map_err(|e| e.to_string())?;

        let payload = match msg.payload {
            Some(p) => p,
            None => continue,
        };

        // Extract sender, recipients and subject from headers
        let mut sender = String::new();
        let mut to_addresses: Vec<String> = Vec::new();
        let mut subject = String::new();
        if let Some(ref headers) = payload.headers {
            for h in headers {
                if h.name.eq_ignore_ascii_case("From") {
                    sender = if let Some(start) = h.value.find('<') {
                        h.value[start + 1..].trim_end_matches('>').to_string()
                    } else {
                        h.value.clone()
                    };
                }
                if h.name.eq_ignore_ascii_case("To") {
                    // Parse "Name <email>, Name2 <email2>" format
                    for part in h.value.split(',') {
                        let addr = if let Some(start) = part.find('<') {
                            part[start + 1..].trim_end_matches('>').trim().to_string()
                        } else {
                            part.trim().to_string()
                        };
                        to_addresses.push(addr.to_lowercase());
                    }
                }
                if h.name.eq_ignore_ascii_case("Subject") {
                    subject = h.value.clone();
                }
            }
        }

        // Determine client email: if sender matches a client, use sender.
        // Otherwise check To addresses for a client match (broker sent email to client).
        let contact_email = {
            let sender_lower = sender.to_lowercase();
            if client_emails.iter().any(|ce| ce.to_lowercase() == sender_lower) {
                sender_lower
            } else {
                to_addresses.iter()
                    .find(|to| client_emails.iter().any(|ce| ce.to_lowercase() == **to))
                    .cloned()
                    .unwrap_or(sender_lower)
            }
        };

        // Extract email body from parts or payload body
        let mut email_body: Option<String> = None;
        if let Some(ref parts) = payload.parts {
            for part in parts {
                let is_text = part.mime_type.as_deref() == Some("text/plain")
                    || part.mime_type.as_deref() == Some("text/html");
                if is_text {
                    if let Some(ref body) = part.body {
                        if let Some(ref data) = body.data {
                            let trimmed = data.trim().trim_end_matches('=');
                            if let Ok(decoded) = URL_SAFE_NO_PAD.decode(trimmed) {
                                if let Ok(text) = String::from_utf8(decoded) {
                                    email_body = Some(text);
                                    if part.mime_type.as_deref() == Some("text/plain") {
                                        break; // prefer plain text
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        // Fallback: body directly on payload (no multipart)
        if email_body.is_none() {
            if let Some(ref body) = payload.body {
                if let Some(ref data) = body.data {
                    let trimmed = data.trim().trim_end_matches('=');
                    if let Ok(decoded) = URL_SAFE_NO_PAD.decode(trimmed) {
                        if let Ok(text) = String::from_utf8(decoded) {
                            email_body = Some(text);
                        }
                    }
                }
            }
        }

        // Download attachments
        let mut attachment_paths = Vec::new();
        if let Some(ref parts) = payload.parts {
            for part in parts {
                let filename = match &part.filename {
                    Some(f) if !f.is_empty() => f.clone(),
                    _ => continue,
                };

                let attachment_id = match &part.body {
                    Some(body) => match &body.attachment_id {
                        Some(id) => id.clone(),
                        None => continue,
                    },
                    None => continue,
                };

                let att_url = format!(
                    "https://gmail.googleapis.com/gmail/v1/users/me/messages/{}/attachments/{}",
                    msg.id, attachment_id
                );
                let att_resp = http
                    .get(&att_url)
                    .bearer_auth(token)
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;

                let att: GmailAttachment = att_resp.json().await.map_err(|e| e.to_string())?;

                // Gmail uses URL-safe base64 (may or may not have padding)
                let trimmed = att.data.trim().trim_end_matches('=');
                let data = URL_SAFE_NO_PAD
                    .decode(trimmed)
                    .map_err(|e| format!("Base64 decode error: {}", e))?;

                // Use message ID prefix for unique file paths
                let file_path = import_dir.join(format!("{}_{}", msg.id, filename));
                std::fs::write(&file_path, &data)
                    .map_err(|e| format!("Failed to save attachment: {}", e))?;

                attachment_paths.push(file_path.to_string_lossy().to_string());
            }
        }

        imported.push(SyncedEmail {
            sender: contact_email.clone(),
            subject: subject.clone(),
            attachment_paths,
            body: email_body,
            received_at: None,
            message_id: msg.id.clone(),
        });
    }

    Ok(imported)
}

// ---------------------------------------------------------------------------
// Outlook sync
// ---------------------------------------------------------------------------

async fn sync_outlook(
    http: &HttpClient,
    token: &str,
    client_emails: &[String],
    import_dir: &std::path::Path,
    last_sync_at: &Option<String>,
) -> Result<Vec<SyncedEmail>, String> {
    let mut imported = Vec::new();

    for email in client_emails {
        let email_lower = email.to_lowercase();
        // Track seen message IDs to avoid duplicates across inbox/sent queries
        let mut seen_ids = std::collections::HashSet::new();

        // Search both inbox (from client) and sent items (to client)
        let queries: Vec<(String, String)> = {
            let mut time_filter = String::new();
            if let Some(ref since) = last_sync_at {
                if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(since) {
                    time_filter = format!(
                        " and receivedDateTime ge '{}'",
                        dt.format("%Y-%m-%dT%H:%M:%SZ")
                    );
                }
            }
            vec![
                // Emails FROM the client (in inbox)
                (
                    format!(
                        "https://graph.microsoft.com/v1.0/me/messages?$filter={}&$top=20&$select=id,subject,from,body,receivedDateTime,hasAttachments",
                        urlencoding::encode(&format!("from/emailAddress/address eq '{}'{}",  email_lower, time_filter))
                    ),
                    email_lower.clone(),
                ),
            ]
        };

        for (list_url, client_email) in &queries {
        let resp = http
            .get(list_url)
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| format!("Outlook list failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            eprintln!("[Sync] Outlook filter failed for {} ({}): {}", client_email, status, body);
            continue;
        }

        let list: GraphMessageList = resp.json().await.map_err(|e| e.to_string())?;

        for msg in &list.value {
            // Skip if already processed from another query
            if !seen_ids.insert(msg.id.clone()) {
                continue;
            }

            let sender = msg
                .from
                .as_ref()
                .map(|f| f.email_address.address.clone())
                .unwrap_or_default();
            // Use client email as the contact, whether they sent or received
            let contact_email = client_email.clone();
            let _ = &sender; // keep for logging
            let subject = msg.subject.clone().unwrap_or_default();
            let body = msg.body.as_ref().and_then(|b| b.content.clone());
            let received_at = msg.received_date_time.clone();

            // Only fetch attachments if the message has them
            let mut attachment_paths = Vec::new();
            if msg.has_attachments {
                let att_url = format!(
                    "https://graph.microsoft.com/v1.0/me/messages/{}/attachments",
                    msg.id
                );
                let att_resp = http
                    .get(&att_url)
                    .bearer_auth(token)
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;

                if att_resp.status().is_success() {
                    let att_list: GraphAttachmentList =
                        att_resp.json().await.map_err(|e| e.to_string())?;

                    for att in &att_list.value {
                        let is_file = att
                            .odata_type
                            .as_ref()
                            .map(|t| t.contains("fileAttachment"))
                            .unwrap_or(false);
                        if !is_file {
                            continue;
                        }

                        let filename = att.name.clone().unwrap_or_else(|| "attachment".to_string());
                        let content = match &att.content_bytes {
                            Some(c) => c,
                            None => continue,
                        };

                        use base64::engine::general_purpose::STANDARD;
                        let data = STANDARD
                            .decode(content)
                            .map_err(|e| format!("Base64 decode error: {}", e))?;

                        // Use message ID prefix for unique file paths
                        let file_path = import_dir.join(format!("{}_{}", msg.id, filename));
                        std::fs::write(&file_path, &data)
                            .map_err(|e| format!("Failed to save attachment: {}", e))?;

                        attachment_paths.push(file_path.to_string_lossy().to_string());
                    }
                }
            }

            imported.push(SyncedEmail {
                sender: contact_email.clone(),
                subject,
                attachment_paths,
                body,
                received_at,
                message_id: msg.id.clone(),
            });
        }
        } // end queries loop
    }

    Ok(imported)
}

// ---------------------------------------------------------------------------
// Upcoming calendar meetings
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UpcomingMeeting {
    pub title: String,
    pub start_time: String,
    pub end_time: String,
    pub attendee_email: Option<String>,
    pub client_name: Option<String>,
    pub provider: String,
}

#[tauri::command]
pub async fn get_upcoming_meetings(
    state: State<'_, AppState>,
) -> Result<Vec<UpcomingMeeting>, String> {
    // Get connected providers and client emails
    let (providers, client_map) = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare("SELECT provider FROM oauth_tokens")
            .map_err(|e| e.to_string())?;
        let providers: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        // Build email -> client name map
        let mut client_stmt = conn
            .prepare("SELECT email, first_name, last_name FROM clients WHERE email IS NOT NULL AND email != ''")
            .map_err(|e| e.to_string())?;
        let client_map: std::collections::HashMap<String, String> = client_stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?.to_lowercase(),
                    format!("{} {}", row.get::<_, String>(1)?, row.get::<_, String>(2)?),
                ))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        (providers, client_map)
    };

    if providers.is_empty() {
        return Ok(vec![]);
    }

    // Build list of (name, first_name, last_name) for title matching fallback
    let client_names: Vec<(String, String)> = client_map.values()
        .map(|full_name| {
            let lower = full_name.to_lowercase();
            (full_name.clone(), lower)
        })
        .collect();

    let http = HttpClient::new();
    let mut all_meetings: Vec<UpcomingMeeting> = Vec::new();
    let now = chrono::Utc::now();

    for provider in &providers {
        let token = get_valid_token(&state, provider).await?;

        match provider.as_str() {
            "google" => {
                let time_min = now.to_rfc3339();
                let time_max = (now + chrono::Duration::days(7)).to_rfc3339();
                let url = format!(
                    "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin={}&timeMax={}&singleEvents=true&orderBy=startTime&maxResults=10",
                    urlencoding::encode(&time_min),
                    urlencoding::encode(&time_max),
                );

                let resp = http.get(&url).bearer_auth(&token).send().await;
                if let Ok(resp) = resp {
                    if resp.status().is_success() {
                        if let Ok(data) = resp.json::<serde_json::Value>().await {
                            if let Some(items) = data["items"].as_array() {
                                for item in items {
                                    let title = item["summary"].as_str().unwrap_or("").to_string();
                                    let start = item["start"]["dateTime"]
                                        .as_str()
                                        .or_else(|| item["start"]["date"].as_str())
                                        .unwrap_or("")
                                        .to_string();
                                    let end = item["end"]["dateTime"]
                                        .as_str()
                                        .or_else(|| item["end"]["date"].as_str())
                                        .unwrap_or("")
                                        .to_string();

                                    // Check attendees against client list
                                    let mut attendee_email = None;
                                    let mut client_name = None;
                                    if let Some(attendees) = item["attendees"].as_array() {
                                        for att in attendees {
                                            if let Some(email) = att["email"].as_str() {
                                                let email_lower = email.to_lowercase();
                                                if let Some(name) = client_map.get(&email_lower) {
                                                    attendee_email = Some(email.to_string());
                                                    client_name = Some(name.clone());
                                                    break;
                                                }
                                            }
                                        }
                                    }

                                    // Fallback: match client name in meeting title
                                    if client_name.is_none() {
                                        let title_lower = title.to_lowercase();
                                        for (full_name, name_lower) in &client_names {
                                            if title_lower.contains(name_lower.as_str()) {
                                                client_name = Some(full_name.clone());
                                                break;
                                            }
                                        }
                                    }

                                    all_meetings.push(UpcomingMeeting {
                                        title,
                                        start_time: start,
                                        end_time: end,
                                        attendee_email,
                                        client_name,
                                        provider: "google".to_string(),
                                    });
                                }
                            }
                        }
                    }
                }
            }
            "microsoft" => {
                let time_min = now.format("%Y-%m-%dT%H:%M:%S").to_string();
                let time_max = (now + chrono::Duration::days(7))
                    .format("%Y-%m-%dT%H:%M:%S")
                    .to_string();
                let url = format!(
                    "https://graph.microsoft.com/v1.0/me/calendarview?startdatetime={}&enddatetime={}&$top=10&$orderby=start/dateTime&$select=subject,start,end,attendees",
                    urlencoding::encode(&time_min),
                    urlencoding::encode(&time_max),
                );

                let resp = http.get(&url).bearer_auth(&token).send().await;
                if let Ok(resp) = resp {
                    if resp.status().is_success() {
                        if let Ok(data) = resp.json::<serde_json::Value>().await {
                            if let Some(items) = data["value"].as_array() {
                                for item in items {
                                    let title = item["subject"].as_str().unwrap_or("").to_string();
                                    let start = item["start"]["dateTime"]
                                        .as_str()
                                        .unwrap_or("")
                                        .to_string();
                                    let end = item["end"]["dateTime"]
                                        .as_str()
                                        .unwrap_or("")
                                        .to_string();

                                    let mut attendee_email = None;
                                    let mut client_name = None;
                                    if let Some(attendees) = item["attendees"].as_array() {
                                        for att in attendees {
                                            if let Some(email) = att["emailAddress"]["address"].as_str() {
                                                let email_lower = email.to_lowercase();
                                                if let Some(name) = client_map.get(&email_lower) {
                                                    attendee_email = Some(email.to_string());
                                                    client_name = Some(name.clone());
                                                    break;
                                                }
                                            }
                                        }
                                    }

                                    // Fallback: match client name in meeting title
                                    if client_name.is_none() {
                                        let title_lower = title.to_lowercase();
                                        for (full_name, name_lower) in &client_names {
                                            if title_lower.contains(name_lower.as_str()) {
                                                client_name = Some(full_name.clone());
                                                break;
                                            }
                                        }
                                    }

                                    all_meetings.push(UpcomingMeeting {
                                        title,
                                        start_time: start,
                                        end_time: end,
                                        attendee_email,
                                        client_name,
                                        provider: "microsoft".to_string(),
                                    });
                                }
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }

    // Sort by start time
    all_meetings.sort_by(|a, b| a.start_time.cmp(&b.start_time));

    Ok(all_meetings)
}

// ---------------------------------------------------------------------------
// Calendar event creation
// ---------------------------------------------------------------------------

async fn create_google_event(
    http: &HttpClient,
    token: &str,
    event: &CalendarEvent,
) -> Result<String, String> {
    let mut body = serde_json::json!({
        "summary": event.title,
        "start": {
            "dateTime": event.start_time,
        },
        "end": {
            "dateTime": event.end_time,
        },
    });

    if let Some(ref desc) = event.description {
        body["description"] = serde_json::json!(desc);
    }
    if let Some(ref attendee) = event.attendee_email {
        body["attendees"] = serde_json::json!([{ "email": attendee }]);
    }

    let resp = http
        .post("https://www.googleapis.com/calendar/v3/calendars/primary/events")
        .bearer_auth(token)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Google Calendar request failed: {}", e))?;

    if !resp.status().is_success() {
        let err_text = resp.text().await.unwrap_or_default();
        return Err(format!("Failed to create event: {}", err_text));
    }

    let result: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let link = result["htmlLink"]
        .as_str()
        .unwrap_or("")
        .to_string();

    Ok(link)
}

async fn create_microsoft_event(
    http: &HttpClient,
    token: &str,
    event: &CalendarEvent,
) -> Result<String, String> {
    let mut body = serde_json::json!({
        "subject": event.title,
        "start": {
            "dateTime": event.start_time,
            "timeZone": "UTC",
        },
        "end": {
            "dateTime": event.end_time,
            "timeZone": "UTC",
        },
    });

    if let Some(ref desc) = event.description {
        body["body"] = serde_json::json!({
            "contentType": "Text",
            "content": desc,
        });
    }
    if let Some(ref attendee) = event.attendee_email {
        body["attendees"] = serde_json::json!([{
            "emailAddress": { "address": attendee },
            "type": "required",
        }]);
    }

    let resp = http
        .post("https://graph.microsoft.com/v1.0/me/events")
        .bearer_auth(token)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Microsoft Calendar request failed: {}", e))?;

    if !resp.status().is_success() {
        let err_text = resp.text().await.unwrap_or_default();
        return Err(format!("Failed to create event: {}", err_text));
    }

    let result: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let link = result["webLink"]
        .as_str()
        .unwrap_or("")
        .to_string();

    Ok(link)
}

#[cfg(test)]
mod tests {
    use super::*;

    // -----------------------------------------------------------------------
    // PKCE generation tests
    // -----------------------------------------------------------------------

    #[test]
    fn pkce_verifier_length_is_64() {
        let (verifier, _challenge) = generate_pkce();
        assert_eq!(verifier.len(), 64);
    }

    #[test]
    fn pkce_verifier_is_alphanumeric() {
        let (verifier, _challenge) = generate_pkce();
        assert!(
            verifier.chars().all(|c| c.is_ascii_alphanumeric()),
            "Verifier should only contain alphanumeric characters, got: {}",
            verifier
        );
    }

    #[test]
    fn pkce_challenge_is_valid_base64url() {
        let (_verifier, challenge) = generate_pkce();

        // base64url must not contain '+', '/', or '=' (no padding)
        assert!(
            !challenge.contains('+'),
            "Challenge must not contain '+': {}",
            challenge
        );
        assert!(
            !challenge.contains('/'),
            "Challenge must not contain '/': {}",
            challenge
        );
        assert!(
            !challenge.contains('='),
            "Challenge must not contain '=' padding: {}",
            challenge
        );

        // Should be decodable as base64url without padding
        let decoded = URL_SAFE_NO_PAD.decode(&challenge);
        assert!(
            decoded.is_ok(),
            "Challenge should be valid base64url: {}",
            challenge
        );

        // SHA-256 output is 32 bytes
        assert_eq!(decoded.unwrap().len(), 32);
    }

    #[test]
    fn pkce_challenge_is_sha256_of_verifier() {
        let (verifier, challenge) = generate_pkce();

        // Manually compute expected challenge
        let mut hasher = Sha256::new();
        hasher.update(verifier.as_bytes());
        let expected = URL_SAFE_NO_PAD.encode(hasher.finalize());

        assert_eq!(challenge, expected);
    }

    #[test]
    fn pkce_produces_different_verifiers() {
        let (v1, _) = generate_pkce();
        let (v2, _) = generate_pkce();
        assert_ne!(
            v1, v2,
            "Two calls to generate_pkce should produce different verifiers"
        );
    }

    // -----------------------------------------------------------------------
    // Token expiry logic tests
    // -----------------------------------------------------------------------

    /// Helper that mirrors the expiry check in get_valid_token:
    /// returns true if the token is still valid (i.e., now + 5min < expires_at).
    fn is_token_valid(expires_at_rfc3339: &str) -> bool {
        let expires = chrono::DateTime::parse_from_rfc3339(expires_at_rfc3339)
            .expect("invalid rfc3339 timestamp");
        let now = chrono::Utc::now();
        let buffer = chrono::Duration::minutes(5);
        now + buffer < expires
    }

    #[test]
    fn token_valid_when_expires_far_in_future() {
        let future = (chrono::Utc::now() + chrono::Duration::hours(1)).to_rfc3339();
        assert!(
            is_token_valid(&future),
            "Token expiring in 1 hour should be valid"
        );
    }

    #[test]
    fn token_invalid_when_already_expired() {
        let past = (chrono::Utc::now() - chrono::Duration::hours(1)).to_rfc3339();
        assert!(
            !is_token_valid(&past),
            "Token that expired 1 hour ago should be invalid"
        );
    }

    #[test]
    fn token_invalid_within_5_minute_buffer() {
        // Token expires in 3 minutes -- within the 5-minute buffer
        let soon = (chrono::Utc::now() + chrono::Duration::minutes(3)).to_rfc3339();
        assert!(
            !is_token_valid(&soon),
            "Token expiring in 3 minutes should be treated as invalid (5-min buffer)"
        );
    }

    #[test]
    fn token_valid_just_outside_buffer() {
        // Token expires in 6 minutes -- outside the 5-minute buffer
        let later = (chrono::Utc::now() + chrono::Duration::minutes(6)).to_rfc3339();
        assert!(
            is_token_valid(&later),
            "Token expiring in 6 minutes should be valid (outside 5-min buffer)"
        );
    }
}

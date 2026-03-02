use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{get_opt_f64, AppState};

const MOONSHOT_API_KEY: &str = "sk-W6JizdRnbHbs5FQAoivgVj193EVxyU1pnjYtP8Tdgw9fnvCE";
const MOONSHOT_BASE_URL: &str = "https://api.moonshot.ai/v1/chat/completions";
const MOONSHOT_MODEL: &str = "moonshot-v1-32k";

#[derive(Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f64,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatMessageResponse,
}

#[derive(Deserialize)]
struct ChatMessageResponse {
    content: String,
}

pub async fn call_moonshot(system_prompt: &str, user_content: &str) -> Result<String, String> {
    let client = reqwest::Client::new();

    let request = ChatRequest {
        model: MOONSHOT_MODEL.to_string(),
        messages: vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_prompt.to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: user_content.to_string(),
            },
        ],
        temperature: 0.3,
    };

    let response = client
        .post(MOONSHOT_BASE_URL)
        .header("Authorization", format!("Bearer {}", MOONSHOT_API_KEY))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Failed to call Moonshot API: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Moonshot API error ({}): {}", status, body));
    }

    let chat_response: ChatResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Moonshot response: {}", e))?;

    chat_response
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .ok_or_else(|| "No response from Moonshot API".to_string())
}

#[tauri::command]
pub async fn generate_meeting_summary(
    state: State<'_, AppState>,
    meeting_id: i64,
) -> Result<String, String> {
    let transcript = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let transcript: String = conn
            .query_row(
                "SELECT COALESCE(transcript, '') FROM meetings WHERE id = ?1",
                [meeting_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Meeting not found: {}", e))?;

        if transcript.trim().is_empty() {
            return Err("No transcript available for this meeting".to_string());
        }
        transcript
    };

    let system_prompt = "You are an AI assistant for a mortgage broker. Write a short summary (3-5 lines max) of this meeting transcript so the broker can skip reading the full transcript. \
        Extract only what matters: key financial figures (loan amounts, rates, deposit, property values), \
        what was agreed or decided, and any action items. \
        Be direct and specific. No filler, no headings, no bullet points. Use plain text, not markdown.";

    let summary = call_moonshot(system_prompt, &transcript).await?;

    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE meetings SET summary = ?1 WHERE id = ?2",
            rusqlite::params![summary, meeting_id],
        )
        .map_err(|e| format!("Failed to save summary: {}", e))?;
    }

    Ok(summary)
}

#[tauri::command]
pub async fn generate_client_summary(
    state: State<'_, AppState>,
    client_id: i64,
) -> Result<String, String> {
    let user_content = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;

        // Get client profile
        let client_info: String = conn
            .query_row(
                "SELECT first_name, last_name, email, phone, income, payg, assets, liabilities, \
                 notes, home_address, investment_addresses, available_deposit, monthly_expenses, \
                 goals, client_status, pipeline_stage, current_lender, current_loan_balance, \
                 current_interest_rate, current_loan_type \
                 FROM clients WHERE id = ?1",
                [client_id],
                |row| {
                    let first_name: String = row.get(0)?;
                    let last_name: String = row.get(1)?;
                    let email: String = row.get(2)?;
                    let phone: String = row.get(3)?;
                    let income: Option<f64> = get_opt_f64(row, 4)?;
                    let payg: Option<f64> = get_opt_f64(row, 5)?;
                    let assets: Option<f64> = get_opt_f64(row, 6)?;
                    let liabilities: Option<f64> = get_opt_f64(row, 7)?;
                    let notes: String = row.get::<_, Option<String>>(8)?.unwrap_or_default();
                    let home_address: String = row.get::<_, Option<String>>(9)?.unwrap_or_default();
                    let investment_addresses: String = row.get::<_, Option<String>>(10)?.unwrap_or_default();
                    let available_deposit: Option<f64> = get_opt_f64(row, 11)?;
                    let monthly_expenses: Option<f64> = get_opt_f64(row, 12)?;
                    let goals: String = row.get::<_, Option<String>>(13)?.unwrap_or_default();
                    let client_status: String = row.get::<_, Option<String>>(14)?.unwrap_or_default();
                    let pipeline_stage: String = row.get::<_, Option<String>>(15)?.unwrap_or_default();
                    let current_lender: String = row.get::<_, Option<String>>(16)?.unwrap_or_default();
                    let current_loan_balance: Option<f64> = get_opt_f64(row, 17)?;
                    let current_interest_rate: Option<f64> = get_opt_f64(row, 18)?;
                    let current_loan_type: String = row.get::<_, Option<String>>(19)?.unwrap_or_default();

                    Ok(format!(
                        "CLIENT PROFILE:\n\
                         Name: {} {}\nEmail: {}\nPhone: {}\n\
                         Income: ${}\nPAYG: ${}\nAssets: ${}\nLiabilities: ${}\n\
                         Available Deposit: ${}\nMonthly Expenses: ${}\n\
                         Home Address: {}\nInvestment Properties: {}\n\
                         Goals: {}\nStatus: {}\nPipeline Stage: {}\n\
                         Current Lender: {}\nCurrent Loan Balance: ${}\n\
                         Current Interest Rate: {}%\nCurrent Loan Type: {}\n\
                         Notes: {}",
                        first_name, last_name, email, phone,
                        income.map(|v| format!("{:.0}", v)).unwrap_or_else(|| "N/A".to_string()),
                        payg.map(|v| format!("{:.0}", v)).unwrap_or_else(|| "N/A".to_string()),
                        assets.map(|v| format!("{:.0}", v)).unwrap_or_else(|| "N/A".to_string()),
                        liabilities.map(|v| format!("{:.0}", v)).unwrap_or_else(|| "N/A".to_string()),
                        available_deposit.map(|v| format!("{:.0}", v)).unwrap_or_else(|| "N/A".to_string()),
                        monthly_expenses.map(|v| format!("{:.0}", v)).unwrap_or_else(|| "N/A".to_string()),
                        home_address, investment_addresses,
                        goals, client_status, pipeline_stage,
                        current_lender,
                        current_loan_balance.map(|v| format!("{:.0}", v)).unwrap_or_else(|| "N/A".to_string()),
                        current_interest_rate.map(|v| format!("{:.2}", v)).unwrap_or_else(|| "N/A".to_string()),
                        current_loan_type, notes,
                    ))
                },
            )
            .map_err(|e| format!("Client not found: {}", e))?;

        // Get meeting summaries and broker notes
        let mut stmt = conn
            .prepare(
                "SELECT title, summary, meeting_date, notes, meeting_type, broker_notes FROM meetings \
                 WHERE client_id = ?1 AND (summary IS NOT NULL AND summary != '' OR notes IS NOT NULL AND notes != '' OR broker_notes IS NOT NULL AND broker_notes != '') \
                 ORDER BY meeting_date DESC LIMIT 10",
            )
            .map_err(|e| e.to_string())?;

        let meetings: Vec<String> = stmt
            .query_map([client_id], |row| {
                let title: String = row.get(0)?;
                let summary: String = row.get::<_, Option<String>>(1)?.unwrap_or_default();
                let date: String = row.get(2)?;
                let notes: String = row.get::<_, Option<String>>(3)?.unwrap_or_default();
                let meeting_type: String = row.get::<_, Option<String>>(4)?.unwrap_or_default();
                let broker_notes: String = row.get::<_, Option<String>>(5)?.unwrap_or_default();
                let type_label = if meeting_type == "email" { "Email" } else { "Meeting" };
                let mut entry = format!("- {} [{}] ({})", title, type_label, date);
                if !summary.is_empty() {
                    entry.push_str(&format!(": {}", summary));
                }
                if !notes.is_empty() && meeting_type != "email" {
                    entry.push_str(&format!(" | Notes: {}", notes));
                }
                if !broker_notes.is_empty() {
                    entry.push_str(&format!(" | Broker notes: {}", broker_notes));
                }
                Ok(entry)
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        // Get deal history
        let mut stmt = conn
            .prepare(
                "SELECT property_address, loan_amount, lender_name, interest_rate, loan_type, status \
                 FROM deals WHERE client_id = ?1 ORDER BY created_at DESC",
            )
            .map_err(|e| e.to_string())?;

        let deals: Vec<String> = stmt
            .query_map([client_id], |row| {
                let address: String = row.get(0)?;
                let amount: Option<f64> = row.get(1)?;
                let lender: String = row.get::<_, Option<String>>(2)?.unwrap_or_default();
                let rate: Option<f64> = row.get(3)?;
                let loan_type: String = row.get::<_, Option<String>>(4)?.unwrap_or_default();
                let status: String = row.get(5)?;
                Ok(format!(
                    "- {} | ${} | {} | {}% | {} | {}",
                    address,
                    amount.map(|v| format!("{:.0}", v)).unwrap_or_else(|| "N/A".to_string()),
                    lender,
                    rate.map(|v| format!("{:.2}", v)).unwrap_or_else(|| "N/A".to_string()),
                    loan_type,
                    status,
                ))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        // Get document types
        let mut stmt = conn
            .prepare(
                "SELECT document_type, COUNT(*) FROM documents \
                 WHERE client_id = ?1 GROUP BY document_type",
            )
            .map_err(|e| e.to_string())?;

        let docs: Vec<String> = stmt
            .query_map([client_id], |row| {
                let doc_type: String = row.get(0)?;
                let count: i64 = row.get(1)?;
                Ok(format!("- {}: {} documents", doc_type, count))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let mut content = client_info;
        if !meetings.is_empty() {
            content.push_str("\n\nMEETING SUMMARIES:\n");
            content.push_str(&meetings.join("\n"));
        }
        if !deals.is_empty() {
            content.push_str("\n\nDEAL HISTORY:\n");
            content.push_str(&deals.join("\n"));
        }
        if !docs.is_empty() {
            content.push_str("\n\nDOCUMENTS ON FILE:\n");
            content.push_str(&docs.join("\n"));
        }

        content
    };

    let system_prompt = "You are an AI assistant for a mortgage broker. Based on the client data provided, \
        write a concise broker-ready summary (1-2 paragraphs) that covers:\n\
        - The client's current financial position and property portfolio\n\
        - Current loans and recent activity\n\
        - Pipeline stage and next steps\n\
        - Key action items or upcoming needs\n\n\
        Write in third person. Be concise and professional. Use plain text, not markdown.";

    let summary = call_moonshot(system_prompt, &user_content).await?;

    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE clients SET ai_summary = ?1 WHERE id = ?2",
            rusqlite::params![summary, client_id],
        )
        .map_err(|e| format!("Failed to save AI summary: {}", e))?;
    }

    Ok(summary)
}

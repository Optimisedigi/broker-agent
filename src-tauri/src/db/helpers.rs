use rusqlite::Connection;

/// Read a column that may be stored as REAL or TEXT.
pub fn get_opt_f64(row: &rusqlite::Row, idx: usize) -> rusqlite::Result<Option<f64>> {
    match row.get::<_, Option<f64>>(idx) {
        Ok(v) => Ok(v),
        Err(_) => {
            let s: Option<String> = row.get(idx)?;
            Ok(s.and_then(|s| s.parse::<f64>().ok()))
        }
    }
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
            "SELECT id FROM clients WHERE LOWER(email) = LOWER(?1)",
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

    // Skip if this document was already imported for this client
    let already_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM documents WHERE client_id = ?1 AND file_path = ?2",
            rusqlite::params![client_id, document_path],
            |row| row.get::<_, i64>(0),
        )
        .unwrap_or(0)
        > 0;

    if already_exists {
        let doc_id: i64 = conn
            .query_row(
                "SELECT id FROM documents WHERE client_id = ?1 AND file_path = ?2",
                rusqlite::params![client_id, document_path],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        return Ok(doc_id);
    }

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
        "INSERT INTO documents (client_id, filename, document_type, file_path, file_data, source, uploaded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        [
            &client_id.to_string(),
            &filename,
            document_type,
            document_path,
            &file_data,
            "client",
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

#[cfg(test)]
mod tests {
    use super::*;

    // classify_document_type tests

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
        assert_eq!(classify_document_type("national_id.pdf", ""), "id_document");
    }

    // detect_mime_type tests

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

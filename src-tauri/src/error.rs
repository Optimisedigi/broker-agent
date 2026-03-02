use thiserror::Error;

#[derive(Error, Debug)]
pub enum CrmError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("{0}")]
    General(String),
}

impl From<String> for CrmError {
    fn from(s: String) -> Self {
        CrmError::General(s)
    }
}

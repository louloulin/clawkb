use thiserror::Error;

#[derive(Error, Debug)]
pub enum KbError {
    #[error("Knowledge base not open. Call open() or create() first.")]
    NotOpen,

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("Memvid error: {0}")]
    Memvid(String),

    #[error("File not found: {0}")]
    FileNotFound(String),

    #[error("Import error: {0}")]
    Import(String),

    #[error("Invalid search mode: {0}")]
    InvalidSearchMode(String),

    #[error("Encryption error: {0}")]
    Encryption(String),

    #[error("Config error: {0}")]
    Config(String),
}

pub type Result<T> = std::result::Result<T, KbError>;

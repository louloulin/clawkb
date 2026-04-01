use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub path: String,
    pub title: String,
    pub chunks: usize,
    pub tags: Vec<String>,
    pub success: bool,
    pub error: Option<String>,
}

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub path: String,
    pub title: String,
    pub chunks: usize,
    pub tags: Vec<String>,
    /// Auto-classification tags derived from content and path (not in `tags` yet)
    pub auto_tags: Vec<String>,
    pub success: bool,
    pub error: Option<String>,
}

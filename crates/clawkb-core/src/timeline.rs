use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineQuery {
    pub from_date: Option<String>,
    pub to_date: Option<String>,
    pub limit: Option<usize>,
    pub tag: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineEntry {
    pub id: String,
    pub title: String,
    pub timestamp: String,
    pub tags: Vec<String>,
    pub snippet: String,
}

use serde::{Deserialize, Serialize};

/// Summary of a replay session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSummary {
    pub id: String,
    pub name: String,
    pub action_count: usize,
    pub start_time: i64,
    pub end_time: i64,
}

/// A checkpoint within a session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    pub frame_id: u64,
    pub timestamp: i64,
    pub label: Option<String>,
}

/// Result of asking at a specific point in time
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AsOfResult {
    pub answer: String,
    pub citations: Vec<AskCitation>,
    pub context: Vec<ContextFragment>,
    pub frame_cutoff: u64,
    pub timestamp_cutoff: i64,
}

use crate::ask::{AskCitation, ContextFragment};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHit {
    pub id: String,
    pub title: String,
    pub content: String,
    pub score: f32,
    pub tags: Vec<String>,
    pub created_at: String,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SearchMode {
    #[default]
    Hybrid,
    Lexical,
    Semantic,
}

impl SearchMode {
    pub fn from_str(s: &str) -> crate::error::Result<Self> {
        match s.to_lowercase().as_str() {
            "lex" | "lexical" => Ok(Self::Lexical),
            "sem" | "semantic" => Ok(Self::Semantic),
            "hybrid" | "mix" => Ok(Self::Hybrid),
            _ => Err(crate::error::KbError::InvalidSearchMode(s.to_string())),
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Lexical => "lex",
            Self::Semantic => "sem",
            Self::Hybrid => "hybrid",
        }
    }
}

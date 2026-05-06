use serde::{Deserialize, Serialize};

use crate::frontmatter::Frontmatter;

pub const NOTE_META_TAG: &str = "__note_meta__";
pub const NOTE_ID_PREFIX: &str = "note_id:";
pub const NOTE_PATH_PREFIX: &str = "note_path:";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteData {
    pub id: String,
    pub title: String,
    pub content: String,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub source: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct NotePath(String);

impl NotePath {
    pub fn new(path: impl Into<String>) -> Self {
        Self(normalize_note_path(path.into()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl From<&str> for NotePath {
    fn from(value: &str) -> Self {
        Self::new(value)
    }
}

impl From<String> for NotePath {
    fn from(value: String) -> Self {
        Self::new(value)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteRecord {
    pub id: String,
    pub path: NotePath,
    pub title: String,
    pub content: String,
    pub frontmatter: Frontmatter,
    pub created_at: String,
    pub updated_at: String,
    pub source: Option<String>,
    /// IDs of notes that this note links to (extracted from [[...]]).
    pub outlinks: Vec<String>,
    /// IDs of notes that link to this note (computed on save).
    pub backlinks: Vec<String>,
    /// Document outline extracted from headings.
    pub outline: Vec<OutlineNode>,
}

/// A single heading node in the document outline.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutlineNode {
    pub level: u8,
    pub text: String,
    pub position: usize,
}

impl NoteRecord {
    pub fn new(path: NotePath, title: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            id: String::new(),
            path,
            title: title.into(),
            content: content.into(),
            frontmatter: Frontmatter::default(),
            created_at: String::new(),
            updated_at: String::new(),
            source: None,
            outlinks: Vec::new(),
            backlinks: Vec::new(),
            outline: Vec::new(),
        }
    }

    pub fn with_tags(mut self, tags: Vec<String>) -> Self {
        self.frontmatter.tags = tags;
        self
    }

    pub fn with_aliases(mut self, aliases: Vec<String>) -> Self {
        self.frontmatter.aliases = aliases;
        self
    }
}

fn normalize_note_path(path: String) -> String {
    let trimmed = path.trim().trim_matches('/');
    trimmed
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("/")
}

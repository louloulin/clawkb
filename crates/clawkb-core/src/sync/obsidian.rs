//! Obsidian Vault Sync — parse and import Obsidian Markdown vaults.
//!
//! Obsidian vaults contain Markdown files with YAML frontmatter. This module
//! parses the vault structure and extracts metadata for sync with ClawKB.

use serde::{Deserialize, Serialize};
use std::path::Path;
use walkdir::WalkDir;

/// A parsed Markdown file from an Obsidian vault.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObsidianNote {
    /// Relative path from vault root (e.g., "folder/note.md")
    pub path: String,
    /// File name without extension
    pub title: String,
    /// YAML frontmatter fields
    pub frontmatter: ObsidianFrontmatter,
    /// Body text (Markdown content, frontmatter stripped)
    pub content: String,
    /// Tags extracted from frontmatter and content (#tag)
    pub tags: Vec<String>,
    /// Creation date from filesystem metadata
    pub created: Option<String>,
    /// Modification date from filesystem metadata
    pub modified: Option<String>,
}

/// YAML frontmatter fields supported by Obsidian.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ObsidianFrontmatter {
    pub title: Option<String>,
    pub tags: Vec<String>,
    pub aliases: Vec<String>,
    pub created: Option<String>,
    pub modified: Option<String>,
    pub id: Option<String>,
    /// Custom fields are stored here as key-value pairs
    #[serde(flatten)]
    pub extra: std::collections::HashMap<String, String>,
}

/// Summary of a scanned Obsidian vault.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultSummary {
    pub root_path: String,
    pub total_notes: usize,
    pub total_tags: usize,
    pub folders: Vec<String>,
    pub sample_tags: Vec<String>,
}

/// Scan an Obsidian vault and return a summary without parsing all content.
pub fn scan_vault(vault_path: &Path) -> Result<VaultSummary, String> {
    let mut total_notes = 0;
    let mut all_tags: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut folders: std::collections::HashSet<String> = std::collections::HashSet::new();

    for entry in WalkDir::new(vault_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file() || !path.extension().map_or(false, |e| e == "md") {
            continue;
        }

        total_notes += 1;

        // Track folder structure
        if let Ok(rel) = path.strip_prefix(vault_path) {
            if rel.parent().map_or(false, |p: &Path| !p.as_os_str().is_empty()) {
                folders.insert(rel.parent().unwrap().display().to_string());
            }
        }

        // Quick scan for tags (don't fully parse, just grep)
        if let Ok(content) = std::fs::read_to_string(path) {
            for tag in extract_tags_from_content(&content) {
                all_tags.insert(tag);
            }
        }
    }

    let sample_tags: Vec<String> = all_tags.iter().take(20).cloned().collect();
    let mut sorted_folders: Vec<String> = folders.iter().take(50).cloned().collect();
    sorted_folders.sort();

    Ok(VaultSummary {
        root_path: vault_path.display().to_string(),
        total_notes,
        total_tags: all_tags.len(),
        folders: sorted_folders,
        sample_tags,
    })
}

/// Parse a single Obsidian Markdown note.
pub fn parse_note(path: &Path) -> Result<ObsidianNote, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read {:?}: {}", path, e))?;

    let (frontmatter, body) = extract_frontmatter(&content);
    let title = frontmatter.title.clone()
        .or_else(|| {
            path.file_stem()
                .and_then(|s| s.to_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| "Untitled".to_string());

    let tags = {
        let mut t = frontmatter.tags.clone();
        t.extend(extract_tags_from_content(&body));
        t.sort();
        t.dedup();
        t
    };

    let metadata = entry_metadata(path);
    let rel_path = path.file_name()
        .and_then(|s| s.to_str())
        .map(|s| s.to_string())
        .unwrap_or_default();

    Ok(ObsidianNote {
        path: rel_path,
        title,
        frontmatter,
        content: body.trim().to_string(),
        tags,
        created: metadata.0,
        modified: metadata.1,
    })
}

/// Parse all Markdown notes in a vault directory.
pub fn parse_vault(vault_path: &Path) -> Vec<ObsidianNote> {
    WalkDir::new(vault_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file() && e.path().extension().map_or(false, |ext| ext == "md"))
        .filter_map(|e| parse_note(e.path()).ok())
        .collect()
}

/// Extract YAML frontmatter from Markdown content.
fn extract_frontmatter(content: &str) -> (ObsidianFrontmatter, String) {
    let content = content.trim_start();

    if !content.starts_with("---") {
        return (ObsidianFrontmatter::default(), content.to_string());
    }

    let end = match content[3..].find("---") {
        Some(n) => n,
        None => return (ObsidianFrontmatter::default(), content.to_string()),
    };

    let yaml_str = &content[3..end];
    let body = content[end + 6..].trim_start().to_string();

    // Simple YAML parser for Obsidian frontmatter
    let mut fm = ObsidianFrontmatter::default();
    let mut current_list: Option<&mut Vec<String>> = None;

    for line in yaml_str.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        // List continuation
        if line.starts_with("- ") || line.starts_with("  - ") {
            if let Some(ref mut list) = current_list {
                list.push(line.trim_start_matches("- ").trim_start_matches("  - ").to_string());
            }
            continue;
        }

        current_list = None;

        if let Some(colon_pos) = line.find(':') {
            let key = line[..colon_pos].trim().to_string();
            let value = line[colon_pos + 1..].trim();

            if value.is_empty() {
                match key.as_str() {
                    "tags" | "tag" => {
                        fm.tags = Vec::new();
                        current_list = Some(&mut fm.tags);
                    }
                    "aliases" | "alias" => {
                        fm.aliases = Vec::new();
                        current_list = Some(&mut fm.aliases);
                    }
                    _ => {}
                }
            } else {
                match key.as_str() {
                    "title" => fm.title = Some(value.to_string()),
                    "created" | "date" | "birthtime" => fm.created = Some(value.to_string()),
                    "modified" | "changed" | "mtime" => fm.modified = Some(value.to_string()),
                    "id" | "uid" => fm.id = Some(value.to_string()),
                    _ => {
                        if !value.is_empty() {
                            fm.extra.insert(key, value.to_string());
                        }
                    }
                }
            }
        }
    }

    (fm, body)
}

/// Extract Obsidian tags (#tag) from content.
fn extract_tags_from_content(content: &str) -> Vec<String> {
    let mut tags = Vec::new();
    let mut in_code_block = false;

    for line in content.lines() {
        // Toggle code block state
        if line.starts_with("```") {
            in_code_block = !in_code_block;
            continue;
        }
        if in_code_block {
            continue;
        }

        // Skip frontmatter
        if line.starts_with("---") {
            continue;
        }

        for word in line.split_whitespace() {
            if word.starts_with('#') {
                let tag = word.trim_end_matches(|c: char| !c.is_alphanumeric() && c != '-' && c != '_')
                    .trim_start_matches('#');
                if !tag.is_empty() && !tag.chars().next().map_or(false, |c| c.is_numeric()) {
                    tags.push(tag.to_lowercase());
                }
            }
        }
    }

    tags.sort();
    tags.dedup();
    tags
}

/// Get filesystem metadata for a file.
fn entry_metadata(path: &Path) -> (Option<String>, Option<String>) {
    use chrono::{DateTime, Utc};

    let metadata = match path.metadata().ok() {
        Some(m) => m,
        None => return (None, None),
    };
    let created = metadata.created().ok()
        .map(|t| {
            let dt: DateTime<Utc> = t.into();
            dt.to_rfc3339()
        });
    let modified = metadata.modified().ok()
        .map(|t| {
            let dt: DateTime<Utc> = t.into();
            dt.to_rfc3339()
        });

    (created, modified)
}

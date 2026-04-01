//! Folder management module for ClawKB
//!
//! Implements multi-level folder organization for documents.
//! Folders are stored as special tags in memvid.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Folder information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderInfo {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub path: String,
    pub doc_count: usize,
    pub created_at: i64,
}

/// Folder tree node for UI
#[derive(Debug, Clone)]
pub struct FolderNode {
    pub folder: FolderInfo,
    pub children: Vec<FolderNode>,
}

/// Parse folder path from a tag value
pub fn parse_folder_tag(tag: &str) -> Option<(String, String)> {
    if let Some(path) = tag.strip_prefix("folder_path:") {
        // Extract folder name from path
        let name = path.split('/').last().unwrap_or(path);
        Some((path.to_string(), name.to_string()))
    } else if let Some(id) = tag.strip_prefix("folder:") {
        Some((id.to_string(), id.to_string()))
    } else {
        None
    }
}

/// Build folder hierarchy from flat list
pub fn build_folder_tree(folders: Vec<FolderInfo>) -> Vec<FolderNode> {
    let mut map: HashMap<String, FolderNode> = HashMap::new();
    let mut roots: Vec<FolderNode> = Vec::new();

    // Create nodes
    for folder in &folders {
        map.insert(folder.id.clone(), FolderNode {
            folder: folder.clone(),
            children: Vec::new(),
        });
    }

    // Build tree
    for folder in &folders {
        if let Some(node) = map.get_mut(&folder.id) {
            if let Some(ref parent_id) = folder.parent_id {
                if let Some(parent) = map.get_mut(parent_id) {
                    parent.children.push(node.clone());
                } else {
                    // Parent not found, treat as root
                    roots.push(node.clone());
                }
            } else {
                roots.push(node.clone());
            }
        }
    }

    // Sort children by name
    fn sort_children(node: &mut FolderNode) {
        node.children.sort_by(|a, b| a.folder.name.cmp(&b.folder.name));
        for child in &mut node.children {
            sort_children(child);
        }
    }
    for node in &mut roots {
        sort_children(node);
    }

    roots
}

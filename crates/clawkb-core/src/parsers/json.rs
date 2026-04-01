//! JSON parser
//!
//! Parses JSON files and converts them to readable text format.

use super::{ParsedDocument, DocumentMetadata};

/// Parse a JSON file and convert it to readable text
pub fn parse_json(bytes: &[u8]) -> Result<ParsedDocument, String> {
    let content = String::from_utf8_lossy(bytes);

    // Try to parse as JSON value
    let json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let mut title = None;
    let mut metadata = DocumentMetadata::default();

    // Extract metadata from common JSON fields
    if let Some(obj) = json.as_object() {
        if let Some(t) = obj.get("title").or(obj.get("name")).or(obj.get("Title")).or(obj.get("Name")) {
            if let Some(s) = t.as_str() {
                title = Some(s.to_string());
            }
        }
        if let Some(author) = obj.get("author").or(obj.get("Author")).or(obj.get("creator")).or(obj.get("Creator")) {
            if let Some(s) = author.as_str() {
                metadata.author = Some(s.to_string());
            }
        }
        if let Some(created) = obj.get("created").or(obj.get("createdAt")).or(obj.get("created_at")) {
            if let Some(s) = created.as_str() {
                metadata.created = Some(s.to_string());
            }
        }
    }

    // Flatten JSON to text
    let content = flatten_json(&json, 0);

    Ok(ParsedDocument {
        title,
        content,
        metadata,
    })
}

/// Flatten a JSON value to readable text
fn flatten_json(value: &serde_json::Value, depth: usize) -> String {
    let indent = "  ".repeat(depth);

    match value {
        serde_json::Value::Null => String::new(),
        serde_json::Value::Bool(b) => b.to_string(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Array(arr) => {
            if arr.is_empty() {
                return String::new();
            }
            let items: Vec<String> = arr
                .iter()
                .enumerate()
                .map(|(i, v)| {
                    let item_text = flatten_json(v, depth + 1);
                    if item_text.is_empty() {
                        String::new()
                    } else if v.is_object() || v.is_array() {
                        format!("{}[{}]: {}", indent, i, item_text)
                    } else {
                        format!("{}{}", indent, item_text)
                    }
                })
                .filter(|s| !s.is_empty())
                .collect();

            items.join("\n")
        }
        serde_json::Value::Object(obj) => {
            if obj.is_empty() {
                return String::new();
            }

            let items: Vec<String> = obj
                .iter()
                .map(|(k, v)| {
                    let value_text = flatten_json(v, depth + 1);
                    if value_text.is_empty() {
                        format!("{}{}: (empty)", indent, k)
                    } else if v.is_object() {
                        format!("{}{}:\n{}", indent, k, value_text)
                    } else if v.is_array() && !value_text.contains('\n') {
                        format!("{}{}: {}", indent, k, value_text)
                    } else {
                        format!("{}{}:\n{}{}", indent, k, value_text, indent)
                    }
                })
                .filter(|s| !s.trim().is_empty())
                .collect();

            items.join("\n")
        }
    }
}

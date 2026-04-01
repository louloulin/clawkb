//! DOCX (Microsoft Word 2007+) parser
//!
//! Parses .docx files by extracting content from the internal XML structure.
//! DOCX files are ZIP archives containing XML files.

use super::{ParsedDocument, DocumentMetadata};

/// Parse a DOCX file and extract its text content
pub fn parse_docx(bytes: &[u8]) -> Result<ParsedDocument, String> {
    let cursor = std::io::Cursor::new(bytes);
    let archive = zip::ZipArchive::new(cursor)
        .map_err(|e| format!("Failed to read DOCX as ZIP: {}", e))?;

    let mut title = None;
    let mut content_parts: Vec<String> = Vec::new();
    let mut metadata = DocumentMetadata::default();

    // Read document.xml - the main content
    if let Ok(mut file) = archive.by_name("word/document.xml") {
        let mut xml_content = String::new();
        file.read_to_string(&mut xml_content)
            .map_err(|e| format!("Failed to read document.xml: {}", e))?;

        // Extract text from XML using simple tag stripping
        // This is a lightweight approach - for better results, use an XML parser
        let text = extract_text_from_xml(&xml_content);
        content_parts.push(text);
    }

    // Read core.xml for metadata
    if let Ok(mut file) = archive.by_name("docProps/core.xml") {
        let mut xml_content = String::new();
        file.read_to_string(&mut xml_content)
            .map_err(|e| format!("Failed to read core.xml: {}", e))?;

        // Parse metadata from XML
        if let Some(t) = extract_xml_value(&xml_content, "dc:title") {
            title = Some(t);
        }
        if let Some(a) = extract_xml_value(&xml_content, "dc:creator") {
            metadata.author = Some(a);
        }
        if let Some(d) = extract_xml_value(&xml_content, "dcterms:created") {
            metadata.created = Some(d);
        }
    }

    // Also check app.xml for page count
    if let Ok(mut file) = archive.by_name("docProps/app.xml") {
        let mut xml_content = String::new();
        file.read_to_string(&mut xml_content)
            .map_err(|e| format!("Failed to read app.xml: {}", e))?;

        if let Some(pages) = extract_xml_value(&xml_content, "Pages") {
            if let Ok(p) = pages.parse::<usize>() {
                metadata.page_count = Some(p);
            }
        }
    }

    let content = content_parts.join("\n\n");

    Ok(ParsedDocument {
        title,
        content: content.trim().to_string(),
        metadata,
    })
}

/// Extract plain text from XML by stripping tags
fn extract_text_from_xml(xml: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;
    let mut in_w = false; // w:t element (text runs)
    let mut prev_was_text = false;

    let bytes = xml.as_bytes();
    let mut i = 0;

    while i < bytes.len() {
        // Check for <w:t ...> or </w:t>
        if i + 4 < bytes.len() {
            let rest = &bytes[i..];
            if rest.starts_with(b"<w:t") {
                in_w = true;
                i += 4;
                // Skip to >
                while i < bytes.len() && bytes[i] != b'>' {
                    i += 1;
                }
                i += 1;
                continue;
            }
            if rest.starts_with(b"</w:t>") {
                in_w = false;
                i += 6;
                continue;
            }
        }

        let c = bytes[i] as char;

        if c == '<' {
            in_tag = true;
            // Check if this is a paragraph or line break tag
            if i + 2 < bytes.len() {
                let rest = &bytes[i..];
                if rest.starts_with(b"</w:p>") || rest.starts_with(b"<w:p ") {
                    if prev_was_text {
                        result.push('\n');
                        prev_was_text = false;
                    }
                }
                if rest.starts_with(b"<w:br") || rest.starts_with(b"</w:br>") {
                    result.push('\n');
                }
            }
        } else if c == '>' {
            in_tag = false;
        } else if !in_tag {
            result.push(c);
            prev_was_text = true;
        }

        i += 1;
    }

    // Clean up whitespace
    let lines: Vec<&str> = result
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect();

    lines.join("\n")
}

/// Extract a value from XML by tag name
fn extract_xml_value(xml: &str, tag: &str) -> Option<String> {
    let open_tag = format!("<{}", tag);
    let close_tag = format!("</{}>", tag);

    if let Some(start) = xml.find(&open_tag) {
        let value_start = xml[start..].find('>')? + start + 1;
        if let Some(end) = xml[value_start..].find(&close_tag) {
            return Some(xml[value_start..value_start + end].trim().to_string());
        }
    }

    None
}

use std::io::Read;

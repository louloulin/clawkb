//! PPTX (Microsoft PowerPoint 2007+) parser
//!
//! Parses .pptx files by extracting text from each slide.
//! PPTX files are ZIP archives containing XML files for each slide.

use super::{ParsedDocument, DocumentMetadata};

/// Parse a PPTX file and extract text from all slides
pub fn parse_pptx(bytes: &[u8]) -> Result<ParsedDocument, String> {
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| format!("Failed to read PPTX as ZIP: {}", e))?;

    let mut title = None;
    let mut slide_contents: Vec<String> = Vec::new();
    let mut metadata = DocumentMetadata::default();
    let mut slide_count = 0;

    // Collect all slide files
    let mut slide_files: Vec<String> = Vec::new();
    for i in 0..archive.len() {
        if let Ok(file) = archive.by_index(i) {
            let name = file.name().to_string();
            if name.starts_with("ppt/slides/slide") && name.ends_with(".xml") && !name.contains("_rels") {
                slide_files.push(name);
            }
        }
    }

    // Sort slides by number
    slide_files.sort();

    // Process each slide
    for slide_file in &slide_files {
        if let Ok(mut file) = archive.by_name(slide_file) {
            let mut xml_content = String::new();
            file.read_to_string(&mut xml_content)
                .map_err(|e| format!("Failed to read slide XML: {}", e))?;

            // Extract text from the slide
            let text = extract_text_from_slide(&xml_content);
            if !text.trim().is_empty() {
                slide_count += 1;
                slide_contents.push(format!("=== Slide {} ===\n{}", slide_count, text));
            }
        }
    }

    metadata.slide_count = Some(slide_count);

    // Try to get title from presentation.xml
    if let Ok(mut file) = archive.by_name("ppt/presentation.xml") {
        let mut xml_content = String::new();
        file.read_to_string(&mut xml_content)
            .map_err(|e| format!("Failed to read presentation.xml: {}", e))?;

        if let Some(t) = extract_xml_value(&xml_content, "sldTitle") {
            title = Some(t);
        }
    }

    // Build content from slides
    let content = if slide_contents.is_empty() {
        String::new()
    } else {
        slide_contents.join("\n\n")
    };

    Ok(ParsedDocument {
        title,
        content: content.trim().to_string(),
        metadata,
    })
}

/// Extract plain text from a slide XML
fn extract_text_from_slide(xml: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;
    let mut prev_was_text = false;

    let bytes = xml.as_bytes();
    let mut i = 0;

    while i < bytes.len() {
        // Check for <a:t> (text element in PPTX)
        if i + 4 < bytes.len() {
            let rest = &bytes[i..];
            if rest.starts_with(b"<a:t") {
                i += 4;
                // Skip to >
                while i < bytes.len() && bytes[i] != b'>' {
                    i += 1;
                }
                i += 1;
                continue;
            }
            if rest.starts_with(b"</a:t>") {
                i += 6;
                continue;
            }
        }

        // Check for paragraph end
        if i + 7 < bytes.len() {
            let rest = &bytes[i..];
            if rest.starts_with(b"</a:p>") {
                if prev_was_text {
                    result.push('\n');
                    prev_was_text = false;
                }
                i += 7;
                continue;
            }
        }

        let c = bytes[i] as char;

        if c == '<' {
            in_tag = true;
        } else if c == '>' {
            in_tag = false;
        } else if !in_tag {
            result.push(c);
            prev_was_text = true;
        }

        i += 1;
    }

    // Clean up
    result
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
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

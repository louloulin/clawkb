//! EPUB (Electronic Publication) parser
//!
//! Parses .epub files by extracting content from chapters.
//! EPUB files are ZIP archives containing XHTML content.

use super::{ParsedDocument, DocumentMetadata};

/// Parse an EPUB file and extract text from all chapters
pub fn parse_epub(bytes: &[u8]) -> Result<ParsedDocument, String> {
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| format!("Failed to read EPUB as ZIP: {}", e))?;

    let mut title = None;
    let mut author = None;
    let mut chapter_contents: Vec<String> = Vec::new();
    let mut metadata = DocumentMetadata::default();

    // First, read container.xml to find the OPF file
    let opf_path = get_opf_path(&mut archive)?;

    // Get the directory containing the OPF file
    let opf_dir = opf_path
        .rsplit('/')
        .nth(1)
        .map(|s| s.to_string())
        .unwrap_or_default();

    // Read the OPF file to get spine order and metadata
    let (spine_items, opf_content) = parse_opf(&mut archive, &opf_path)?;

    // Extract title and author from OPF
    if let Some(t) = extract_opf_metadata(&opf_content, "title") {
        title = Some(t);
    }
    if let Some(a) = extract_opf_metadata(&opf_content, "creator") {
        author = Some(a);
    }
    metadata.author = author;

    // Read each item in spine order
    for item_href in &spine_items {
        // Resolve the full path
        let full_path = if item_href.starts_with('/') {
            item_href[1..].to_string()
        } else if opf_dir.is_empty() {
            item_href.to_string()
        } else {
            format!("{}/{}", opf_dir, item_href)
        };

        if let Ok(mut file) = archive.by_name(&full_path) {
            let mut content = String::new();
            if file.read_to_string(&mut content).is_ok() {
                let text = extract_text_from_xhtml(&content);
                if !text.trim().is_empty() {
                    chapter_contents.push(text);
                }
            }
        }
    }

    // If no chapters found via spine, try to find all XHTML files
    if chapter_contents.is_empty() {
        let mut xhtml_files: Vec<String> = Vec::new();
        for i in 0..archive.len() {
            if let Ok(file) = archive.by_index(i) {
                let name = file.name().to_string();
                if (name.ends_with(".xhtml") || name.ends_with(".html") || name.ends_with(".htm"))
                    && !name.contains("_images")
                    && !name.contains("_fonts")
                {
                    xhtml_files.push(name);
                }
            }
        }

        for xhtml_file in xhtml_files {
            if let Ok(mut file) = archive.by_name(&xhtml_file) {
                let mut content = String::new();
                if file.read_to_string(&mut content).is_ok() {
                    let text = extract_text_from_xhtml(&content);
                    if !text.trim().is_empty() {
                        chapter_contents.push(text);
                    }
                }
            }
        }
    }

    let content = chapter_contents.join("\n\n");

    Ok(ParsedDocument {
        title,
        content: content.trim().to_string(),
        metadata,
    })
}

/// Get the OPF file path from container.xml
fn get_opf_path(archive: &mut zip::ZipArchive<std::io::Cursor<&[u8]>>) -> Result<String, String> {
    if let Ok(mut file) = archive.by_name("META-INF/container.xml") {
        let mut xml_content = String::new();
        file.read_to_string(&mut xml_content)
            .map_err(|e| format!("Failed to read container.xml: {}", e))?;

        // Find rootfile path
        if let Some(start) = xml_content.find("full-path=\"") {
            let path_start = start + 12;
            if let Some(end) = xml_content[path_start..].find('"') {
                return Ok(xml_content[path_start..path_start + end].to_string());
            }
        }
    }

    Err("Could not find OPF file path in container.xml".to_string())
}

/// Parse the OPF file to get spine order
fn parse_opf(
    archive: &mut zip::ZipArchive<std::io::Cursor<&[u8]>>,
    opf_path: &str,
) -> Result<(Vec<String>, String), String> {
    let mut file = archive
        .by_name(opf_path)
        .map_err(|e| format!("Failed to open OPF file: {}", e))?;

    let mut content = String::new();
    file.read_to_string(&mut content)
        .map_err(|e| format!("Failed to read OPF file: {}", e))?;

    // Get the directory containing the OPF file
    let opf_dir = opf_path
        .rsplit('/')
        .nth(1)
        .map(|s| s.to_string())
        .unwrap_or_default();

    // Build manifest map (id -> href)
    let mut manifest: std::collections::HashMap<String, String> = std::collections::HashMap::new();

    // Parse manifest items
    let mut pos = 0;
    while let Some(item_start) = content[pos..].find("<item ") {
        let actual_pos = pos + item_start;
        if let Some(id_start) = content[actual_pos..].find("id=\"") {
            let id_value_start = actual_pos + id_start + 4;
            if let Some(id_end) = content[id_value_start..].find('"') {
                let id = content[id_value_start..id_value_start + id_end].to_string();

                // Find href
                if let Some(href_start) = content[id_value_start + id_end..].find("href=\"") {
                    let href_value_start = id_value_start + id_end + href_start + 6;
                    if let Some(href_end) = content[href_value_start..].find('"') {
                        let href = content[href_value_start..href_value_start + href_end].to_string();
                        manifest.insert(id, href);
                    }
                }
            }
        }
        pos = actual_pos + 1;
    }

    // Parse spine order
    let mut spine_items: Vec<String> = Vec::new();
    pos = 0;
    while let Some(itemref_start) = content[pos..].find("<itemref ") {
        let actual_pos = pos + itemref_start;
        if let Some(idref_start) = content[actual_pos..].find("idref=\"") {
            let idref_value_start = actual_pos + idref_start + 7;
            if let Some(idref_end) = content[idref_value_start..].find('"') {
                let idref = content[idref_value_start..idref_value_start + idref_end].to_string();
                if let Some(href) = manifest.get(&idref) {
                    let full_path = if opf_dir.is_empty() {
                        href.clone()
                    } else {
                        format!("{}/{}", opf_dir, href)
                    };
                    spine_items.push(full_path);
                }
            }
        }
        pos = actual_pos + 1;
    }

    Ok((spine_items, content))
}

/// Extract metadata from OPF file
fn extract_opf_metadata(content: &str, tag: &str) -> Option<String> {
    // Handle both dc: and regular namespace prefixes
    let tags_to_try = vec![
        format!("dc:{}", tag),
        format!("<{}>", tag),
    ];

    for tag_pattern in &tags_to_try {
        let close_tag = format!("</dc:{}>", tag);
        if let Some(start) = content.find(tag_pattern) {
            let value_start = start + tag_pattern.len();
            if let Some(end) = content[value_start..].find(&close_tag) {
                return Some(content[value_start..value_start + end].trim().to_string());
            }
        }
    }

    None
}

/// Extract plain text from XHTML content
fn extract_text_from_xhtml(html: &str) -> String {
    let mut result = String::new();
    let bytes = html.as_bytes();
    let mut i = 0;
    let mut in_script = false;
    let mut in_style = false;
    let mut in_tag = false;
    let mut prev_was_text = false;

    while i < bytes.len() {
        // Check for script/style tags
        if i + 8 < bytes.len() {
            let rest = &bytes[i..];
            if rest.starts_with(b"<script") || rest.starts_with(b"<style") {
                in_script = true;
                in_style = rest.starts_with(b"<style");
            }
            if rest.starts_with(b"</script>") {
                in_script = false;
                i += 9;
                continue;
            }
            if rest.starts_with(b"</style>") {
                in_style = false;
                i += 8;
                continue;
            }
        }

        if in_script || in_style {
            i += 1;
            continue;
        }

        if i + 2 < bytes.len() {
            let rest = &bytes[i..];
            // Check for paragraph/line break
            if rest.starts_with(b"<p") || rest.starts_with(b"<div") {
                if prev_was_text {
                    result.push('\n');
                    prev_was_text = false;
                }
            }
            if rest.starts_with(b"</p>") || rest.starts_with(b"</div>") || rest.starts_with(b"<br") {
                if prev_was_text {
                    result.push('\n');
                    prev_was_text = false;
                }
                // Skip to end of tag
                while i < bytes.len() && bytes[i] != b'>' {
                    i += 1;
                }
                i += 1;
                continue;
            }
            if rest.starts_with(b"<h1") || rest.starts_with(b"<h2") || rest.starts_with(b"<h3") {
                if prev_was_text {
                    result.push_str("\n## ");
                    prev_was_text = false;
                }
            }
            if rest.starts_with(b"</h1>") || rest.starts_with(b"</h2>") || rest.starts_with(b"</h3>") {
                if prev_was_text {
                    result.push('\n');
                    prev_was_text = false;
                }
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

    // Clean up whitespace
    result
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

use std::io::Read;

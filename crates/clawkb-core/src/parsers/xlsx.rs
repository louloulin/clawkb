//! XLSX (Microsoft Excel 2007+) parser
//!
//! Parses .xlsx files by extracting text from each sheet.
//! XLSX files are ZIP archives containing XML files for each sheet.

use super::{ParsedDocument, DocumentMetadata};
use memchr::memmem;

/// Parse an XLSX file and extract text from all sheets
pub fn parse_xlsx(bytes: &[u8]) -> Result<ParsedDocument, String> {
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| format!("Failed to read XLSX as ZIP: {}", e))?;

    let mut title = None;
    let mut sheet_contents: Vec<String> = Vec::new();
    let mut metadata = DocumentMetadata::default();
    let mut sheet_count = 0;

    // Get sheet names from workbook.xml
    let sheet_names = get_sheet_names(&mut archive);
    metadata.sheet_count = Some(sheet_names.len());

    // Collect all shared strings (for text lookup)
    let shared_strings = get_shared_strings(&mut archive);

    // Collect all sheet files
    let mut sheet_files: Vec<(String, String)> = Vec::new(); // (name, path)
    for i in 0..archive.len() {
        if let Ok(file) = archive.by_index(i) {
            let name = file.name().to_string();
            if name.starts_with("xl/worksheets/sheet") && name.ends_with(".xml") && !name.contains("_rels") {
                // Find the sheet name
                let sheet_num: usize = name
                    .strip_prefix("xl/worksheets/sheet")
                    .and_then(|s| s.strip_suffix(".xml"))
                    .unwrap_or("1")
                    .parse()
                    .unwrap_or(1);
                let sheet_name = sheet_names.get(sheet_num - 1).cloned().unwrap_or(format!("Sheet {}", sheet_num));
                sheet_files.push((sheet_name, name));
            }
        }
    }

    // Sort sheets by number
    sheet_files.sort_by(|a, b| {
        let num_a: usize = a.1
            .strip_prefix("xl/worksheets/sheet")
            .and_then(|s| s.strip_suffix(".xml"))
            .unwrap_or("0")
            .parse()
            .unwrap_or(0);
        let num_b: usize = b.1
            .strip_prefix("xl/worksheets/sheet")
            .and_then(|s| s.strip_suffix(".xml"))
            .unwrap_or("0")
            .parse()
            .unwrap_or(0);
        num_a.cmp(&num_b)
    });

    // Process each sheet
    for (sheet_name, sheet_file) in &sheet_files {
        if let Ok(mut file) = archive.by_name(sheet_file) {
            let mut xml_content = String::new();
            file.read_to_string(&mut xml_content)
                .map_err(|e| format!("Failed to read sheet XML: {}", e))?;

            // Extract data from the sheet
            let sheet_text = extract_sheet_data(&xml_content, &shared_strings);
            if !sheet_text.trim().is_empty() {
                sheet_count += 1;
                sheet_contents.push(format!("=== {} ===\n{}", sheet_name, sheet_text));
            }
        }
    }

    metadata.sheet_count = Some(sheet_count);

    // Try to get title from document properties
    if let Ok(mut file) = archive.by_name("docProps/core.xml") {
        let mut xml_content = String::new();
        file.read_to_string(&mut xml_content)
            .map_err(|e| format!("Failed to read core.xml: {}", e))?;

        if let Some(t) = extract_xml_value(&xml_content, "dc:title") {
            title = Some(t);
        }
    }

    let content = sheet_contents.join("\n\n");

    Ok(ParsedDocument {
        title,
        content: content.trim().to_string(),
        metadata,
    })
}

/// Get sheet names from workbook.xml
fn get_sheet_names(archive: &mut zip::ZipArchive<std::io::Cursor<&[u8]>>) -> Vec<String> {
    let mut names = Vec::new();

    if let Ok(mut file) = archive.by_name("xl/workbook.xml") {
        let mut xml_content = String::new();
        if file.read_to_string(&mut xml_content).is_ok() {
            // Extract sheet names from <sheet name="..."> tags
            let mut pos = 0;
            while let Some(start) = xml_content[pos..].find("<sheet ") {
                let actual_start = pos + start;
                if let Some(name_start) = xml_content[actual_start..].find("name=\"") {
                    let value_start = actual_start + name_start + 6;
                    if let Some(name_end) = xml_content[value_start..].find('"') {
                        names.push(xml_content[value_start..value_start + name_end].to_string());
                        pos = value_start + name_end;
                        continue;
                    }
                }
                pos = actual_start + 1;
            }
        }
    }

    names
}

/// Get shared strings for text lookup
fn get_shared_strings(archive: &mut zip::ZipArchive<std::io::Cursor<&[u8]>>) -> Vec<String> {
    let mut strings = Vec::new();

    if let Ok(mut file) = archive.by_name("xl/sharedStrings.xml") {
        let mut xml_content = String::new();
        if file.read_to_string(&mut xml_content).is_ok() {
            // Extract text from <t> tags
            let mut in_t = false;
            let mut current = String::new();

            for chunk in xml_content.split_inclusive('<') {
                if chunk.starts_with("<t") && !chunk.contains("/>") {
                    in_t = true;
                    if let Some(end_tag) = chunk.find('>') {
                        current.push_str(&chunk[end_tag + 1..]);
                    }
                } else if chunk.starts_with("</t>") {
                    if in_t {
                        strings.push(current.trim().to_string());
                        current.clear();
                        in_t = false;
                    }
                } else if in_t {
                    current.push_str(chunk);
                }
            }
        }
    }

    strings
}

/// Extract data from a sheet XML
fn extract_sheet_data(xml: &str, shared_strings: &[String]) -> String {
    let mut rows: Vec<Vec<String>> = Vec::new();
    let mut current_row: Vec<String> = Vec::new();
    let mut current_cell = String::new();
    let mut in_t = false;
    let mut in_cell = false;

    let bytes = xml.as_bytes();
    let mut i = 0;

    while i < bytes.len() {
        // Check for cell start
        if i + 3 < bytes.len() {
            let rest = &bytes[i..];
            if rest.starts_with(b"<c ") || rest.starts_with(b"<c>") {
                in_cell = true;
                // Extract cell reference
                if rest.starts_with(b"<c ") {
                    if let Some(r_start) = memmem::find(rest, b"r=\"") {
                        let r_value_start = r_start + 3;
                        let _ = memchr::memchr(b'\"', &rest[r_value_start..]);
                    }
                }
                current_cell.clear();
                i += if rest.starts_with(b"<c ") { 3 } else { 3 };
                continue;
            }
            if rest.starts_with(b"</c>") {
                // Get cell value based on type
                let cell_value = current_cell.trim().to_string();
                if !cell_value.is_empty() {
                    current_row.push(cell_value);
                }
                in_cell = false;
                i += 4;
                continue;
            }
            if rest.starts_with(b"</row>") || rest.starts_with(b"<row ") {
                if !current_row.is_empty() {
                    rows.push(current_row.clone());
                    current_row.clear();
                }
                // Skip to end of tag
                while i < bytes.len() && bytes[i] != b'>' {
                    i += 1;
                }
                i += 1;
                continue;
            }
        }

        // Check for text element
        if i + 3 < bytes.len() {
            let rest = &bytes[i..];
            if rest.starts_with(b"<t") && !rest.starts_with(b"</t") {
                // Check if it's a shared string reference
                if rest.starts_with(b"<t>") {
                    in_t = true;
                    i += 3;
                    continue;
                }
                if rest.starts_with(b"<t ") {
                    // Check for inline string
                    if let Some(is_start) = memmem::find(rest, b"t=\"inlineStr\"") {
                        // This is an inline string, skip to > then capture text
                        if let Some(gt) = rest[is_start..].iter().position(|&c| c == b'>') {
                            let text_start = is_start + gt + 1;
                            if let Some(text_end) = memmem::find(&rest[text_start..], b"</is>") {
                                let text = String::from_utf8_lossy(&rest[text_start..text_start + text_end]).to_string();
                                current_cell.push_str(&text);
                            }
                        }
                    } else if let Some(v_start) = rest.iter().position(|&c| c == b'>') {
                        // Regular text, continue to capture
                        in_t = true;
                        i += v_start + 1;
                        continue;
                    }
                }
            }
            if rest.starts_with(b"</t>") {
                in_t = false;
                i += 4;
                continue;
            }
            // Check for shared string reference <v> index </v>
            if rest.starts_with(b"<v>") && in_cell {
                let value_start = i + 3;
                if let Some(value_end) = memmem::find(rest, b"</v>") {
                    if let Ok(index) = String::from_utf8_lossy(&rest[value_start..value_end]).parse::<usize>() {
                        if index < shared_strings.len() {
                            current_cell.push_str(&shared_strings[index]);
                        }
                    }
                    i = value_start + value_end + 5;
                    continue;
                }
            }
        }

        let c = bytes[i] as char;

        if !in_cell && c == '<' {
            // Skip tag
            while i < bytes.len() && bytes[i] != b'>' {
                i += 1;
            }
            i += 1;
            continue;
        }

        if in_t {
            current_cell.push(c);
        }

        i += 1;
    }

    // Convert rows to text
    rows.into_iter()
        .map(|row| row.join(" | "))
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

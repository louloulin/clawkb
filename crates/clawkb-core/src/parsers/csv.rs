//! CSV (Comma-Separated Values) parser
//!
//! Parses CSV files and flattens them into readable text format.

use super::{ParsedDocument, DocumentMetadata};

/// Parse a CSV file and flatten it to text
pub fn parse_csv(bytes: &[u8]) -> Result<ParsedDocument, String> {
    let content = String::from_utf8_lossy(bytes);

    let delimiter = detect_delimiter(&content);
    let mut reader = csv::ReaderBuilder::new()
        .delimiter(delimiter as u8)
        .has_headers(true)
        .flexible(true)
        .from_reader(content.as_bytes());

    let mut title = None;
    let let mut records: Vec<String> = Vec::new();
    let mut headers: Vec<String> = Vec::new();

    // Read headers
    if let Ok(hdrs) = reader.headers() {
        headers = hdrs.iter().map(|s| s.to_string()).collect();
        if !headers.is_empty() {
            records.push(format!("Columns: {}", headers.join(", ")));
        }
    }

    // Read records
    let mut row_count = 0;
    for result in reader.records() {
        match result {
            Ok(record) => {
                row_count += 1;
                let row_text: Vec<String> = record.iter().map(|s| s.to_string()).collect();
                // Format as key-value pairs using headers
                let formatted: String = headers
                    .iter()
                    .zip(row_text.iter())
                    .map(|(h, v)| {
                        if v.is_empty() {
                            String::new()
                        } else {
                            format!("{}: {}", h, v)
                        }
                    })
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<_>>()
                    .join(", ");

                if !formatted.is_empty() {
                    records.push(formatted);
                }
            }
            Err(_) => {
                // Skip malformed rows
            }
        }
    }

    // Create content from records
    let content = if records.is_empty() {
        String::new()
    } else {
        records.join("\n")
    };

    let mut metadata = DocumentMetadata::default();
    metadata.author = None;
    metadata.file_size = Some(bytes.len() as u64);

    Ok(ParsedDocument {
        title,
        content,
        metadata,
    })
}

/// Detect the delimiter used in the CSV file
fn detect_delimiter(content: &str) -> char {
    // Common delimiters
    let delimiters = [',', ';', '\t', '|'];

    // Count occurrences in the first few lines
    let sample: String = content.lines().take(5).collect();
    let mut max_count = 0;
    let mut best_delimiter = ',';

    for &delim in &delimiters {
        let count = sample.chars().filter(|&c| c == delim).count();
        if count > max_count {
            max_count = count;
            best_delimiter = delim;
        }
    }

    best_delimiter
}

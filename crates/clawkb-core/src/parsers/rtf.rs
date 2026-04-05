//! RTF (Rich Text Format) parser
//!
//! Parses RTF files by stripping control codes and extracting plain text.

use super::{ParsedDocument, DocumentMetadata};

/// Parse an RTF file and extract plain text
pub fn parse_rtf(bytes: &[u8]) -> Result<ParsedDocument, String> {
    let content = String::from_utf8_lossy(bytes);

    // Basic RTF stripping - remove control words and groups
    let mut result = String::new();
    let mut chars: Vec<char> = content.chars().collect();
    let mut i = 0;
    let mut in_group: usize = 0;
    let mut skip_next = false;

    while i < chars.len() {
        let c = chars[i];

        if skip_next {
            skip_next = false;
            i += 1;
            continue;
        }

        match c {
            '{' => {
                in_group += 1;
                // Check for metadata groups like \author, \title
                if i + 1 < chars.len() && chars[i + 1] == '\\' {
                    let rest: String = chars[i + 2..].iter().take(20).collect();
                    if rest.starts_with("title\\") || rest.starts_with("author\\") || rest.starts_with("subject\\") {
                        // Keep these groups for metadata extraction
                    }
                }
            }
            '}' => {
                in_group = in_group.saturating_sub(1usize);
            }
            '\\' => {
                // Control word
                let mut word = String::new();
                let mut j = i + 1;

                // Handle escaped characters
                if j < chars.len() {
                    match chars[j] {
                        '\'' => {
                            // Hex character
                            if j + 2 < chars.len() {
                                if let Ok(byte) = u8::from_str_radix(
                                    &chars[j + 1..j + 3].iter().collect::<String>(),
                                    16,
                                ) {
                                    result.push(byte as char);
                                }
                                i = j + 3;
                                continue;
                            }
                        }
                        '\\' => {
                            result.push('\\');
                            i = j + 1;
                            continue;
                        }
                        '{' => {
                            result.push('{');
                            i = j + 1;
                            continue;
                        }
                        '}' => {
                            result.push('}');
                            i = j + 1;
                            continue;
                        }
                        '\n' | '\r' => {
                            // Line break
                            result.push('\n');
                            i = j + 1;
                            continue;
                        }
                        _ => {
                            // Collect control word
                            while j < chars.len() && chars[j].is_alphanumeric() {
                                word.push(chars[j]);
                                j += 1;
                            }
                            // Skip optional parameter
                            while j < chars.len() && (chars[j].is_ascii_digit() || chars[j] == '-') {
                                word.push(chars[j]);
                                j += 1;
                            }
                            // Skip space after control word
                            if j < chars.len() && chars[j] == ' ' {
                                j += 1;
                            }

                            // Handle special control words
                            match word.as_str() {
                                "par" | "line" | "lbr" => {
                                    result.push('\n');
                                }
                                "tab" => {
                                    result.push('\t');
                                }
                                "sect" => {
                                    result.push_str("\n---\n");
                                }
                                "page" => {
                                    result.push_str("\n---\n");
                                }
                                "title" | "author" | "subject" | "keywords" => {
                                    // Skip metadata fields - they'll be handled separately
                                }
                                _ => {
                                    // Skip control words
                                }
                            }

                            i = j;
                            continue;
                        }
                    }
                }
            }
            '\r' => {
                if i + 1 < chars.len() && chars[i + 1] == '\n' {
                    i += 1;
                }
                result.push('\n');
            }
            '\n' => {
                result.push('\n');
            }
            _ => {
                if c.is_control() {
                    // Skip control characters except tab
                } else {
                    result.push(c);
                }
            }
        }

        i += 1;
    }

    // Clean up whitespace
    let cleaned: String = result
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join("\n");

    Ok(ParsedDocument {
        title: None,
        content: cleaned,
        metadata: DocumentMetadata::default(),
    })
}

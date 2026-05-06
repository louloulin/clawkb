use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::error::Result;
use crate::kb::KnowledgeBase;

const MAX_CONTENT_LENGTH: usize = 10 * 1024 * 1024; // 10MB
const HTTP_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchUrlResult {
    pub url: String,
    pub title: String,
    pub content_length: usize,
    pub success: bool,
    pub error: Option<String>,
}

impl KnowledgeBase {
    /// Fetch a URL and import its content into the knowledge base.
    pub fn fetch_url(
        &mut self,
        url: &str,
        tags: &[&str],
    ) -> Result<FetchUrlResult> {
        let client = reqwest::blocking::Client::builder()
            .timeout(HTTP_TIMEOUT)
            .build()
            .unwrap_or_else(|_| reqwest::blocking::Client::new());

        let response = client.get(url).send();

        let response = match response {
            Ok(r) => r,
            Err(e) => {
                return Ok(FetchUrlResult {
                    url: url.to_string(),
                    title: String::new(),
                    content_length: 0,
                    success: false,
                    error: Some(format!("HTTP request failed: {}", e)),
                });
            }
        };

        let status = response.status();
        if !status.is_success() {
            return Ok(FetchUrlResult {
                url: url.to_string(),
                title: String::new(),
                content_length: 0,
                success: false,
                error: Some(format!(
                    "HTTP {}: {}",
                    status.as_u16(),
                    status.canonical_reason().unwrap_or("Unknown")
                )),
            });
        }

        let html = match response.text() {
            Ok(b) => {
                if b.len() > MAX_CONTENT_LENGTH {
                    return Ok(FetchUrlResult {
                        url: url.to_string(),
                        title: String::new(),
                        content_length: 0,
                        success: false,
                        error: Some(format!(
                            "Content too large: {} bytes (max {}MB)",
                            b.len(),
                            MAX_CONTENT_LENGTH / (1024 * 1024)
                        )),
                    });
                }
                b
            }
            Err(e) => {
                return Ok(FetchUrlResult {
                    url: url.to_string(),
                    title: String::new(),
                    content_length: 0,
                    success: false,
                    error: Some(format!("Failed to read response: {}", e)),
                });
            }
        };

        // Extract title from HTML
        let title = extract_title(&html).unwrap_or_else(|| url.to_string());

        // Strip HTML tags to get plain text
        let content = strip_html(&html);
        let content_length = content.len();

        // Store in knowledge base using the public API
        let mut all_tags: Vec<&str> = tags.to_vec();
        all_tags.push("web");

        self.add_note(&title, &content, &all_tags)?;

        Ok(FetchUrlResult {
            url: url.to_string(),
            title,
            content_length,
            success: true,
            error: None,
        })
    }

    /// Fetch multiple URLs and import them.
    pub fn fetch_urls(
        &mut self,
        urls: &[&str],
        tags: &[&str],
    ) -> Result<Vec<FetchUrlResult>> {
        let mut results = Vec::with_capacity(urls.len());
        for url in urls {
            results.push(self.fetch_url(url, tags)?);
        }
        Ok(results)
    }
}

/// Extract the <title> content from HTML (pub(crate) for testing).
pub(crate) fn extract_title(html: &str) -> Option<String> {
    let lower = html.to_lowercase();
    let start_tag = lower.find("<title>")?;
    let start = start_tag.checked_add(7)?;
    let end = lower.find("</title>")?;
    if end <= start || start >= html.len() {
        return None;
    }
    let end = end.min(html.len());
    Some(html[start..end].trim().to_string())
}

/// Strip HTML tags to get plain text (pub(crate) for testing).
pub(crate) fn strip_html(html: &str) -> String {
    let mut result = String::with_capacity(html.len() / 2);
    let mut in_tag = false;
    let mut in_script = false;
    let mut in_style = false;

    let chars: Vec<char> = html.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        let ch = chars[i];

        if ch == '<' {
            in_tag = true;
            // Check if entering script/style
            let remaining: String = chars[i..].iter().collect();
            let lower = remaining.to_lowercase();
            if lower.starts_with("<script") {
                in_script = true;
            } else if lower.starts_with("<style") {
                in_style = true;
            } else if lower.starts_with("</script") {
                in_script = false;
            } else if lower.starts_with("</style") {
                in_style = false;
            }
            i += 1;
            continue;
        }

        if ch == '>' {
            in_tag = false;
            i += 1;
            continue;
        }

        if in_tag || in_script || in_style {
            i += 1;
            continue;
        }

        // Collapse whitespace
        if ch.is_whitespace() {
            if result.ends_with(' ') {
                i += 1;
                continue;
            }
            result.push(' ');
        } else {
            result.push(ch);
        }

        i += 1;
    }

    // Decode common HTML entities
    let result = result
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ");

    result.trim().to_string()
}

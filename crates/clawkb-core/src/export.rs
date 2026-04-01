use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

use crate::error::{KbError, Result};
use crate::kb::KbStats;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ExportFormat {
    Markdown,
    Html,
    Json,
}

impl ExportFormat {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "md" | "markdown" => Some(Self::Markdown),
            "html" => Some(Self::Html),
            "json" => Some(Self::Json),
            _ => None,
        }
    }

    pub fn extension(&self) -> &'static str {
        match self {
            Self::Markdown => "md",
            Self::Html => "html",
            Self::Json => "json",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportData {
    pub stats: KbStats,
    pub documents: Vec<ExportDocument>,
    pub exported_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportDocument {
    pub id: String,
    pub title: String,
    pub content: String,
    pub tags: Vec<String>,
    pub created_at: String,
    pub source: Option<String>,
}

/// Export data to a string in the specified format.
pub fn export_to_string(data: &ExportData, format: ExportFormat) -> Result<String> {
    match format {
        ExportFormat::Markdown => Ok(export_markdown(data)),
        ExportFormat::Html => Ok(export_html(data)),
        ExportFormat::Json => export_json(data),
    }
}

/// Export data to a file in the specified format.
pub fn export_to_file(data: &ExportData, format: ExportFormat, path: &Path) -> Result<()> {
    let content = export_to_string(data, format)?;

    // Create parent directories if they don't exist
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)?;
        }
    }

    fs::write(path, content)?;
    Ok(())
}

fn export_markdown(data: &ExportData) -> String {
    let mut md = String::new();

    // Header
    md.push_str("# ClawKB Knowledge Base Export\n\n");
    md.push_str(&format!("Generated: {}\n", data.exported_at));
    md.push_str(&format!("Total documents: {}\n", data.documents.len()));
    md.push_str(&format!(
        "Knowledge base size: {} bytes\n",
        data.stats.size_bytes
    ));
    md.push_str(&format!(
        "Frame count: {}\n",
        data.stats.frame_count
    ));
    md.push('\n');

    // Documents
    for doc in &data.documents {
        md.push_str("---\n\n");
        md.push_str(&format!("## {}\n\n", doc.title));

        md.push_str(&format!("- ID: {}\n", doc.id));

        if !doc.tags.is_empty() {
            let tag_str = doc
                .tags
                .iter()
                .map(|t| format!("#{}", t))
                .collect::<Vec<_>>()
                .join(", ");
            md.push_str(&format!("- Tags: {}\n", tag_str));
        }

        if !doc.created_at.is_empty() {
            md.push_str(&format!("- Created: {}\n", doc.created_at));
        }

        if let Some(ref source) = doc.source {
            md.push_str(&format!("- Source: {}\n", source));
        }

        md.push('\n');
        md.push_str(&doc.content);
        md.push_str("\n\n");
    }

    md.push_str("---\n");
    md
}

fn export_html(data: &ExportData) -> String {
    let mut html = String::new();

    html.push_str("<!DOCTYPE html>\n");
    html.push_str("<html lang=\"en\">\n");
    html.push_str("<head>\n");
    html.push_str("  <meta charset=\"UTF-8\">\n");
    html.push_str("  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n");
    html.push_str("  <title>ClawKB Knowledge Base Export</title>\n");
    html.push_str("  <style>\n");
    html.push_str(HTML_CSS);
    html.push_str("  </style>\n");
    html.push_str("</head>\n");
    html.push_str("<body>\n");

    // Header section
    html.push_str("  <header>\n");
    html.push_str("    <h1>ClawKB Knowledge Base Export</h1>\n");
    html.push_str("    <div class=\"meta\">\n");
    html.push_str(&format!(
        "      <span>Generated: {}</span>\n",
        html_escape(&data.exported_at)
    ));
    html.push_str(&format!(
        "      <span>Total documents: {}</span>\n",
        data.documents.len()
    ));
    html.push_str(&format!(
        "      <span>Frame count: {}</span>\n",
        data.stats.frame_count
    ));
    html.push_str(    "    </div>\n");
    html.push_str("  </header>\n");

    // Documents
    html.push_str("  <main>\n");
    for doc in &data.documents {
        html.push_str("    <section class=\"document\">\n");
        html.push_str(&format!(
            "      <h2 class=\"title\">{}</h2>\n",
            html_escape(&doc.title)
        ));

        html.push_str("      <div class=\"metadata\">\n");
        html.push_str(&format!(
            "        <span class=\"field\"><strong>ID:</strong> {}</span>\n",
            html_escape(&doc.id)
        ));

        if !doc.tags.is_empty() {
            let tag_spans: Vec<String> = doc
                .tags
                .iter()
                .map(|t| format!("<span class=\"tag\">{}</span>", html_escape(t)))
                .collect();
            html.push_str(&format!(
                "        <span class=\"field\"><strong>Tags:</strong> {}</span>\n",
                tag_spans.join(" ")
            ));
        }

        if !doc.created_at.is_empty() {
            html.push_str(&format!(
                "        <span class=\"field\"><strong>Created:</strong> {}</span>\n",
                html_escape(&doc.created_at)
            ));
        }

        if let Some(ref source) = doc.source {
            html.push_str(&format!(
                "        <span class=\"field\"><strong>Source:</strong> {}</span>\n",
                html_escape(source)
            ));
        }

        html.push_str("      </div>\n");

        html.push_str(&format!(
            "      <div class=\"content\">{}</div>\n",
            html_escape(&doc.content)
        ));
        html.push_str("    </section>\n");
    }
    html.push_str("  </main>\n");

    // Footer
    html.push_str("  <footer>\n");
    html.push_str("    <p>Exported from ClawKB</p>\n");
    html.push_str("  </footer>\n");

    html.push_str("</body>\n");
    html.push_str("</html>\n");

    html
}

fn export_json(data: &ExportData) -> Result<String> {
    serde_json::to_string_pretty(data).map_err(KbError::from)
}

/// Minimal HTML entity escaping for safe embedding in HTML documents.
fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

const HTML_CSS: &str = r#"
    :root {
      --bg: #ffffff;
      --fg: #1a1a2e;
      --accent: #0f3460;
      --border: #e0e0e0;
      --tag-bg: #e8f0fe;
      --tag-fg: #1a73e8;
      --meta-fg: #555555;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #1a1a2e;
        --fg: #e0e0e0;
        --accent: #62b6cb;
        --border: #333355;
        --tag-bg: #1e3a5f;
        --tag-fg: #62b6cb;
        --meta-fg: #aaaaaa;
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: var(--bg);
      color: var(--fg);
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }

    header {
      border-bottom: 2px solid var(--accent);
      padding-bottom: 1rem;
      margin-bottom: 2rem;
    }

    header h1 {
      color: var(--accent);
      font-size: 1.8rem;
      margin-bottom: 0.5rem;
    }

    header .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 1.5rem;
      color: var(--meta-fg);
      font-size: 0.9rem;
    }

    main {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .document {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      background: var(--bg);
    }

    .document .title {
      color: var(--accent);
      font-size: 1.3rem;
      margin-bottom: 0.75rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.5rem;
    }

    .document .metadata {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 1rem;
      font-size: 0.85rem;
      color: var(--meta-fg);
    }

    .document .metadata .field {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }

    .document .metadata .tag {
      display: inline-block;
      background: var(--tag-bg);
      color: var(--tag-fg);
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-size: 0.8rem;
      margin-right: 0.25rem;
    }

    .document .content {
      white-space: pre-wrap;
      word-wrap: break-word;
      font-size: 0.95rem;
      line-height: 1.7;
    }

    footer {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
      text-align: center;
      color: var(--meta-fg);
      font-size: 0.85rem;
    }
"#;

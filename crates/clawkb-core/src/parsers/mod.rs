//! Document parsing module for ClawKB
//!
//! Supports parsing of various document formats:
//! - DOCX: Microsoft Word 2007+ documents
//! - PPTX: Microsoft PowerPoint 2007+ presentations
//! - XLSX: Microsoft Excel 2007+ spreadsheets
//! - EPUB: Electronic publication format
//! - RTF: Rich Text Format
//! - CSV: Comma-separated values
//! - JSON: JavaScript Object Notation
//!
//! Each parser extracts plain text content suitable for
//! knowledge base indexing.

mod docx;
mod pptx;
mod xlsx;
mod epub;
mod rtf;
mod csv;
mod json;

pub use docx::parse_docx;
pub use pptx::parse_pptx;
pub use xlsx::parse_xlsx;
pub use epub::parse_epub;
pub use rtf::parse_rtf;
pub use csv::parse_csv;
pub use json::parse_json;

/// Represents parsed document content
#[derive(Debug, Clone)]
pub struct ParsedDocument {
    /// Document title (if available)
    pub title: Option<String>,
    /// Extracted plain text content
    pub content: String,
    /// Document metadata
    pub metadata: DocumentMetadata,
}

/// Document metadata
#[derive(Debug, Clone, Default)]
pub struct DocumentMetadata {
    /// Author (if available)
    pub author: Option<String>,
    /// Creation date (if available)
    pub created: Option<String>,
    /// Number of pages (for paginated formats)
    pub page_count: Option<usize>,
    /// Number of slides (for presentations)
    pub slide_count: Option<usize>,
    /// Number of sheets (for spreadsheets)
    pub sheet_count: Option<usize>,
    /// File size in bytes
    pub file_size: Option<u64>,
}

/// Supported document format
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DocumentFormat {
    Docx,
    Pptx,
    Xlsx,
    Epub,
    Rtf,
    Csv,
    Json,
    Unknown,
}

impl DocumentFormat {
    /// Detect format from file extension
    pub fn from_extension(ext: &str) -> Self {
        match ext.to_lowercase().as_str() {
            "docx" => DocumentFormat::Docx,
            "pptx" => DocumentFormat::Pptx,
            "xlsx" => DocumentFormat::Xlsx,
            "xlsm" => DocumentFormat::Xlsx,
            "epub" => DocumentFormat::Epub,
            "rtf" => DocumentFormat::Rtf,
            "csv" => DocumentFormat::Csv,
            "json" => DocumentFormat::Json,
            _ => DocumentFormat::Unknown,
        }
    }
}

impl std::fmt::Display for DocumentFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            DocumentFormat::Docx => "docx",
            DocumentFormat::Pptx => "pptx",
            DocumentFormat::Xlsx => "xlsx",
            DocumentFormat::Epub => "epub",
            DocumentFormat::Rtf => "rtf",
            DocumentFormat::Csv => "csv",
            DocumentFormat::Json => "json",
            DocumentFormat::Unknown => "unknown",
        };
        write!(f, "{}", s)
    }
}

/// Parse a document file based on its extension
pub fn parse_document(path: &std::path::Path, ext: &str) -> Result<ParsedDocument, String> {
    let format = DocumentFormat::from_extension(ext);
    let bytes = std::fs::read(path).map_err(|e| format!("Failed to read file: {}", e))?;

    match format {
        DocumentFormat::Docx => parse_docx(&bytes),
        DocumentFormat::Pptx => parse_pptx(&bytes),
        DocumentFormat::Xlsx => parse_xlsx(&bytes),
        DocumentFormat::Epub => parse_epub(&bytes),
        DocumentFormat::Rtf => parse_rtf(&bytes),
        DocumentFormat::Csv => parse_csv(&bytes),
        DocumentFormat::Json => parse_json(&bytes),
        DocumentFormat::Unknown => Err(format!("Unsupported format: {}", ext)),
    }
}

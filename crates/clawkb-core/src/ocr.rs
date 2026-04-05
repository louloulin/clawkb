//! OCR (Optical Character Recognition) for screenshot import.
//!
//! Uses Tesseract CLI via system subprocess. On macOS, install with:
//!   brew install tesseract tesseract-lang
//!
//! Supported languages: English, Chinese (simp), Japanese, Korean.

use base64::{Engine as _, engine::general_purpose};
use std::path::Path;
use tempfile::tempdir;

/// OCR result from processing an image.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OcrResult {
    /// Extracted text (empty if OCR failed)
    pub text: String,
    /// Whether OCR was successful
    pub success: bool,
    /// Error message if failed
    pub error: Option<String>,
    /// Language used for OCR
    pub language: String,
    /// Confidence score (0.0-1.0), None if not available
    pub confidence: Option<f32>,
}

/// Perform OCR on a base64-encoded image.
/// Supports PNG, JPEG, WEBP formats.
pub fn ocr_image(image_data: &str, language: Option<&str>) -> OcrResult {
    let lang = language.unwrap_or("eng");

    // Decode base64 image
    let image_bytes = if let Ok(bytes) = general_purpose::STANDARD.decode(image_data) {
        bytes
    } else {
        // Try URL-safe base64
        general_purpose::URL_SAFE_NO_PAD.decode(image_data).unwrap_or_default()
    };

    if image_bytes.is_empty() {
        return OcrResult {
            text: String::new(),
            success: false,
            error: Some("Failed to decode base64 image data".to_string()),
            language: lang.to_string(),
            confidence: None,
        };
    }

    // Save to temp file
    let temp_dir = match tempdir() {
        Ok(d) => d,
        Err(e) => return OcrResult {
            text: String::new(),
            success: false,
            error: Some(format!("Failed to create temp dir: {}", e)),
            language: lang.to_string(),
            confidence: None,
        },
    };

    // Detect format from magic bytes
    let ext = detect_format(&image_bytes);
    let temp_img_path = temp_dir.path().join(format!("ocr_input.{}", ext));
    let temp_out_path = temp_dir.path().join("ocr_output");

    if let Err(e) = std::fs::write(&temp_img_path, &image_bytes) {
        return OcrResult {
            text: String::new(),
            success: false,
            error: Some(format!("Failed to write temp image: {}", e)),
            language: lang.to_string(),
            confidence: None,
        };
    }

    // Try Tesseract CLI
    let result = run_tesseract(&temp_img_path, &temp_out_path, lang);

    // Clean up temp files (best effort)
    let _ = std::fs::remove_file(&temp_img_path);
    let _ = std::fs::remove_file(&temp_out_path);

    result
}

/// Run Tesseract OCR CLI and return extracted text.
fn run_tesseract(img_path: &Path, out_path: &Path, lang: &str) -> OcrResult {
    // Check if tesseract is available
    let tesseract_check = std::process::Command::new("tesseract")
        .arg("--version")
        .output();

    if tesseract_check.is_err() {
        return OcrResult {
            text: String::new(),
            success: false,
            error: Some(
                "Tesseract not found. Install with:\n  macOS: brew install tesseract tesseract-lang\n  Ubuntu: sudo apt install tesseract-ocr tesseract-ocr-lang".to_string()
            ),
            language: lang.to_string(),
            confidence: None,
        };
    }

    let output = std::process::Command::new("tesseract")
        .arg(img_path)
        .arg(out_path)
        .arg("-l")
        .arg(lang)
        .arg("--psm")
        .arg("3") // Fully automatic page segmentation
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let text = std::fs::read_to_string(out_path)
                .unwrap_or_default()
                .trim()
                .to_string();

            OcrResult {
                text,
                success: true,
                error: None,
                language: lang.to_string(),
                confidence: None, // tesseract --psm 3 doesn't easily provide confidence
            }
        }
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            OcrResult {
                text: String::new(),
                success: false,
                error: Some(format!(
                    "Tesseract failed: {}",
                    if stderr.is_empty() {
                        format!("exit code: {:?}", out.status.code())
                    } else {
                        stderr.to_string()
                    }
                )),
                language: lang.to_string(),
                confidence: None,
            }
        }
        Err(e) => OcrResult {
            text: String::new(),
            success: false,
            error: Some(format!("Failed to run tesseract: {}", e)),
            language: lang.to_string(),
            confidence: None,
        },
    }
}

/// Detect image format from magic bytes.
fn detect_format(bytes: &[u8]) -> &'static str {
    if bytes.len() >= 8 {
        // PNG: 89 50 4E 47
        if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
            return "png";
        }
        // JPEG: FF D8 FF
        if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
            return "jpg";
        }
        // WEBP: RIFF....WEBP
        if bytes.starts_with(b"RIFF") && bytes.len() >= 12 && &bytes[8..12] == b"WEBP" {
            return "webp";
        }
        // GIF: 47 49 46 38
        if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
            return "gif";
        }
        // BMP
        if bytes.starts_with(b"BM") {
            return "bmp";
        }
    }
    "png" // default
}

/// Quick OCR test — returns "ok" if tesseract is installed.
pub fn test_ocr() -> Result<(), String> {
    std::process::Command::new("tesseract")
        .arg("--version")
        .output()
        .map_err(|e| format!("Tesseract not installed: {}", e))?;
    Ok(())
}

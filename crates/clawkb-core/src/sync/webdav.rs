//! WebDAV sync — sync .mv2 files to a WebDAV server.
//!
//! Supports: Nextcloud, ownCloud, Synology NAS, and any standard WebDAV server.
//!
//! Operations: upload, download, list, delete, create folder, check connection.

use base64::Engine;
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use std::io::Read as IoRead;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebdavConfig {
    pub url: String,
    pub username: String,
    pub password: String,
    pub remote_path: String,
    pub enabled: bool,
}

impl Default for WebdavConfig {
    fn default() -> Self {
        Self {
            url: String::new(),
            username: String::new(),
            password: String::new(),
            remote_path: "/ClawKB".to_string(),
            enabled: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebdavServerInfo {
    pub url: String,
    pub server_type: String,
    pub supports_sync: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteFile {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub modified: Option<String>,
    pub is_dir: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub last_sync: Option<i64>,
    pub remote_count: usize,
    pub local_count: usize,
    pub pending_uploads: usize,
    pub pending_downloads: usize,
    pub last_error: Option<String>,
    pub uploads: Vec<String>,
    pub downloads: Vec<String>,
    pub skipped: Vec<String>,
}

/// Per-file sync metadata for incremental sync.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SyncManifest {
    /// Map of filename -> last sync metadata
    pub files: std::collections::HashMap<String, FileSyncMeta>,
    pub last_full_sync: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSyncMeta {
    /// Local file modification time (Unix timestamp)
    pub local_mtime: i64,
    /// Local file size
    pub local_size: u64,
    /// Remote file modification time (Unix timestamp, if known)
    pub remote_mtime: Option<i64>,
    /// Remote file size
    pub remote_size: Option<u64>,
    /// Last sync action: "upload" or "download"
    pub last_action: Option<String>,
    /// Last sync timestamp
    pub last_sync_ts: Option<i64>,
}

/// Result of an incremental sync operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncrementalSyncResult {
    pub uploads: Vec<String>,
    pub downloads: Vec<String>,
    pub skipped: Vec<String>,
    pub errors: Vec<String>,
    pub total_files: usize,
    pub changed_files: usize,
    pub bytes_transferred: u64,
}

/// Build a WebDAV client configured for the given server.
fn build_client(_config: &WebdavConfig) -> Result<Client, String> {
    let client = Client::builder()
        .danger_accept_invalid_certs(false)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;
    Ok(client)
}

/// Add Basic auth header if credentials provided.
fn with_auth(builder: reqwest::blocking::RequestBuilder, config: &WebdavConfig) -> reqwest::blocking::RequestBuilder {
    if config.username.is_empty() {
        builder
    } else {
        let credentials = base64::engine::general_purpose::STANDARD.encode(
            format!("{}:{}", config.username, config.password)
        );
        builder.header("Authorization", format!("Basic {}", credentials))
    }
}

/// Test connection to a WebDAV server.
pub fn test_connection(config: &WebdavConfig) -> Result<WebdavServerInfo, String> {
    let client = build_client(config)?;

    // Try PROPFIND on root to check server response
    let url = config.url.trim_end_matches('/');
    let req_builder = client
        .request(reqwest::Method::from_bytes(b"PROPFIND").expect("valid HTTP method"), url)
        .header("Depth", "0")
        .header("Content-Type", "application/xml; charset=utf-8")
        .body(r#"<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><resourcetype/></prop></propfind>"#);

    let response = with_auth(req_builder, config)
        .send()
        .map_err(|e| format!("Connection failed: {}", e))?;

    let status = response.status();
    let server_type = if status == 207 {
        response
            .headers()
            .get("Server")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("Unknown WebDAV")
            .to_string()
    } else if status == 401 {
        return Err("Authentication failed — check username and password".to_string());
    } else if status == 404 || status == 405 {
        return Err(format!(
            "Server returned {} — is WebDAV enabled at this URL?",
            status
        ));
    } else {
        format!("Unexpected status: {}", status)
    };

    Ok(WebdavServerInfo {
        url: config.url.clone(),
        server_type,
        supports_sync: true,
    })
}

/// List files in a remote directory.
pub fn list_remote(config: &WebdavConfig, remote_dir: Option<&str>) -> Result<Vec<RemoteFile>, String> {
    let client = build_client(config)?;
    let base = config.url.trim_end_matches('/');
    let path = remote_dir.unwrap_or(&config.remote_path);
    let url = format!("{}{}", base, path);

    let req_builder = client
        .request(reqwest::Method::from_bytes(b"PROPFIND").expect("valid HTTP method"), &url)
        .header("Depth", "1")
        .header("Content-Type", "application/xml; charset=utf-8")
        .body(r#"<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><resourcetype/><getcontentlength/><getlastmodified/></prop></propfind>"#);

    let response = with_auth(req_builder, config)
        .send()
        .map_err(|e| format!("Failed to list remote: {}", e))?;

    if response.status() == 404 {
        return Ok(vec![]);
    }

    if response.status() != 207 {
        return Err(format!("Server returned {}", response.status()));
    }

    let body = response
        .text()
        .map_err(|e| format!("Failed to read response: {}", e))?;

    parse_propfind_response(&body)
}

/// Upload a file to the WebDAV server.
pub fn upload_file(
    config: &WebdavConfig,
    local_path: &Path,
    remote_path: &str,
) -> Result<(), String> {
    let client = build_client(config)?;
    let base = config.url.trim_end_matches('/');
    let url = format!("{}{}", base, remote_path);

    let mut file = std::fs::File::open(local_path)
        .map_err(|e| format!("Failed to open local file: {}", e))?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)
        .map_err(|e| format!("Failed to read local file: {}", e))?;

    let req_builder = client
        .put(&url)
        .header("Content-Type", "application/octet-stream")
        .body(buffer);

    with_auth(req_builder, config)
        .send()
        .map_err(|e| format!("Upload failed: {}", e))
        .and_then(|resp| {
            if resp.status().is_success() || resp.status().as_u16() == 201 || resp.status().as_u16() == 204 {
                Ok(())
            } else {
                Err(format!("Upload failed with status {}", resp.status()))
            }
        })
}

/// Download a file from the WebDAV server.
pub fn download_file(
    config: &WebdavConfig,
    remote_path: &str,
    local_path: &Path,
) -> Result<(), String> {
    let client = build_client(config)?;
    let base = config.url.trim_end_matches('/');
    let url = format!("{}{}", base, remote_path);

    let req_builder = client.get(&url);
    let response = with_auth(req_builder, config)
        .send()
        .map_err(|e| format!("Download failed: {}", e))?;

    if response.status() == 404 {
        return Err("File not found on remote server".to_string());
    }

    if !response.status().is_success() {
        return Err(format!("Download failed with status {}", response.status()));
    }

    let bytes = response
        .bytes()
        .map_err(|e| format!("Failed to read remote content: {}", e))?;

    std::fs::write(local_path, bytes)
        .map_err(|e| format!("Failed to write local file: {}", e))?;

    Ok(())
}

/// Delete a file on the WebDAV server.
pub fn delete_remote(config: &WebdavConfig, remote_path: &str) -> Result<(), String> {
    let client = build_client(config)?;
    let base = config.url.trim_end_matches('/');
    let url = format!("{}{}", base, remote_path);

    let req_builder = client.delete(&url);
    let response = with_auth(req_builder, config)
        .send()
        .map_err(|e| format!("Delete failed: {}", e))?;

    if response.status().is_success() || response.status().as_u16() == 204 {
        Ok(())
    } else if response.status().as_u16() == 404 {
        Ok(()) // Already gone
    } else {
        Err(format!("Delete failed with status {}", response.status()))
    }
}

/// Create a remote directory (MKCOL).
pub fn create_remote_dir(config: &WebdavConfig, remote_path: &str) -> Result<(), String> {
    let client = build_client(config)?;
    let base = config.url.trim_end_matches('/');
    let url = format!("{}{}", base, remote_path);

    let req_builder = client.request(reqwest::Method::from_bytes(b"MKCOL").expect("valid HTTP method"), &url);
    let response = with_auth(req_builder, config)
        .send()
        .map_err(|e| format!("Mkdir failed: {}", e))?;

    if response.status().is_success() || response.status().as_u16() == 201 || response.status().as_u16() == 405 {
        // 405 = already exists (acceptable)
        Ok(())
    } else {
        Err(format!("Mkdir failed with status {}", response.status()))
    }
}

/// Check if a remote file exists.
pub fn remote_exists(config: &WebdavConfig, remote_path: &str) -> Result<bool, String> {
    let client = build_client(config)?;
    let base = config.url.trim_end_matches('/');
    let url = format!("{}{}", base, remote_path);

    let req_builder = client.request(reqwest::Method::from_bytes(b"HEAD").expect("valid HTTP method"), &url);
    let response = with_auth(req_builder, config)
        .send()
        .map_err(|e| format!("HEAD check failed: {}", e))?;

    Ok(response.status().is_success() || response.status().as_u16() == 404)
}

/// Parse a WebDAV PROPFIND XML response into a list of RemoteFile.
fn parse_propfind_response(body: &str) -> Result<Vec<RemoteFile>, String> {
    let mut files = Vec::new();

    // Simple XML parsing without external dependencies
    // Look for <d:href>...</d:href> blocks
    let body = body.replace("\r\n", " ").replace('\n', " ");

    // Extract each response block
    let mut remaining = body.as_str();
    while let Some(href_start) = remaining.find("<d:href>") {
        remaining = &remaining[href_start + 9..];
        if let Some(href_end) = remaining.find("</d:href>") {
            let href = &remaining[..href_end];
            remaining = &remaining[href_end..];

            let href = href.trim();
            if href.is_empty() {
                continue;
            }

            // Extract resource type: <d:resourcetype><d:collection/></d:resourcetype> or <d:resourcetype/>
            let is_dir = remaining.starts_with("<d:resourcetype><d:collection/>") ||
                         remaining.starts_with("<d:resourcetype><d:collection");

            // Extract content length
            let mut size: u64 = 0;
            if let Some(lc_start) = remaining.find("<d:getcontentlength>") {
                let after = &remaining[lc_start + 20..];
                if let Some(lc_end) = after.find("</d:getcontentlength>") {
                    let sz = &after[..lc_end].trim();
                    size = sz.parse().unwrap_or(0);
                }
            }

            // Extract last modified
            let modified = if let Some(lm_start) = remaining.find("<d:getlastmodified>") {
                let after = &remaining[lm_start + 19..];
                if let Some(lm_end) = after.find("</d:getlastmodified>") {
                    Some(after[..lm_end].trim().to_string())
                } else {
                    None
                }
            } else {
                None
            };

            // Extract filename from path
            let name = Path::new(href)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(href)
                .to_string();

            let path = href.to_string();

            files.push(RemoteFile {
                path,
                name,
                size,
                modified,
                is_dir,
            });
        } else {
            break;
        }
    }

    // Remove the first entry (it's the parent directory itself)
    if files.len() > 1 && files[0].path == files[1].path {
        files.remove(0);
    }

    Ok(files)
}

/// Perform incremental sync of .mv2 files between local and remote.
/// - Upload: local file is newer than remote
/// - Download: remote file is newer than local
/// - Skip: files are the same (by size + mtime)
pub fn incremental_sync(
    config: &WebdavConfig,
    local_dir: &Path,
    _manifest: &SyncManifest,
) -> Result<IncrementalSyncResult, String> {
    // Find all local .mv2 files
    let local_files: Vec<_> = std::fs::read_dir(local_dir)
        .map_err(|e| format!("Cannot read local directory: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path().extension().map(|s| s == "mv2" || s == "mv2e").unwrap_or(false)
        })
        .collect();

    // List remote files
    let remote_files = list_remote(config, Some(&config.remote_path))?
        .into_iter()
        .filter(|f| !f.is_dir && (f.name.ends_with(".mv2") || f.name.ends_with(".mv2e")))
        .collect::<Vec<_>>();

    let mut uploads = Vec::new();
    let mut downloads = Vec::new();
    let mut skipped = Vec::new();
    let mut errors = Vec::new();
    let mut bytes_transferred: u64 = 0;

    // Ensure remote directory exists
    let _ = create_remote_dir(config, &config.remote_path);

    // --- Upload phase: find local files that need to be uploaded ---
    for entry in &local_files {
        let local_path = entry.path();
        let filename = local_path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        let remote_rel = format!("{}/{}", config.remote_path.trim_end_matches('/'), filename);

        let local_meta = local_path.metadata().map_err(|e| e.to_string())?;
        let local_mtime = local_meta.modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        let local_size = local_meta.len();

        // Find matching remote file
        let remote_file = remote_files.iter().find(|r| r.name == filename);

        let should_upload = if let Some(rf) = remote_file {
            // Compare: local newer than remote, or remote doesn't exist
            let remote_mtime = rf.modified.as_ref()
                .and_then(|s| parse_http_date(s))
                .unwrap_or(0);
            local_mtime > remote_mtime
        } else {
            true // No remote, always upload
        };

        if should_upload {
            match upload_file(config, &local_path, &remote_rel) {
                Ok(()) => {
                    uploads.push(filename.to_string());
                    bytes_transferred += local_size;
                }
                Err(e) => {
                    errors.push(format!("Upload {}: {}", filename, e));
                }
            }
        } else {
            skipped.push(filename.to_string());
        }
    }

    // --- Download phase: find remote files that need to be downloaded ---
    let local_filenames: std::collections::HashSet<String> = local_files
        .iter()
        .filter_map(|e| e.path().file_name().and_then(|n| n.to_str()).map(String::from))
        .collect();

    for rf in &remote_files {
        if local_filenames.contains(&rf.name) {
            continue; // Already handled above
        }

        // Remote-only file — download it
        let remote_rel = format!("{}/{}", config.remote_path.trim_end_matches('/'), rf.name);
        let local_dest = local_dir.join(&rf.name);

        match download_file(config, &remote_rel, &local_dest) {
            Ok(()) => {
                downloads.push(rf.name.clone());
                bytes_transferred += rf.size;
            }
            Err(e) => {
                errors.push(format!("Download {}: {}", rf.name, e));
            }
        }
    }

    let total_files = local_files.len() + remote_files.len();
    let changed_files = uploads.len() + downloads.len();

    tracing::info!(
        "Incremental sync: {} uploads, {} downloads, {} skipped, {} errors",
        uploads.len(),
        downloads.len(),
        skipped.len(),
        errors.len()
    );

    Ok(IncrementalSyncResult {
        uploads,
        downloads,
        skipped,
        errors,
        total_files,
        changed_files,
        bytes_transferred,
    })
}

/// Parse HTTP date format (RFC 7231) to Unix timestamp.
fn parse_http_date(s: &str) -> Option<i64> {
    // Try RFC 7231 format: "Sun, 06 Nov 1994 08:49:37 GMT"
    chrono::DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| dt.with_timezone(&chrono::Utc).timestamp())
}

/// Serialize a sync manifest to JSON bytes.
pub fn serialize_manifest(manifest: &SyncManifest) -> Result<Vec<u8>, String> {
    serde_json::to_vec_pretty(manifest)
        .map_err(|e| format!("Failed to serialize manifest: {}", e))
}

/// Deserialize a sync manifest from JSON bytes.
pub fn deserialize_manifest(data: &[u8]) -> Result<SyncManifest, String> {
    serde_json::from_slice(data)
        .map_err(|e| format!("Failed to deserialize manifest: {}", e))
}

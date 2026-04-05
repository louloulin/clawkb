//! Sync modules for importing external data sources into ClawKB.
//!
//! Currently supports:
//! - Obsidian vault Markdown files
//! - WebDAV remote file sync

pub mod obsidian;
pub mod webdav;

pub use obsidian::{ObsidianNote, VaultSummary, parse_note, parse_vault, scan_vault};
pub use webdav::{
    WebdavConfig, WebdavServerInfo, RemoteFile, SyncStatus,
    SyncManifest, FileSyncMeta, IncrementalSyncResult,
    test_connection, list_remote, upload_file, download_file,
    delete_remote, create_remote_dir, remote_exists,
    incremental_sync, serialize_manifest, deserialize_manifest,
};

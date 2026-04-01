pub mod error;
pub mod kb;
pub mod search;
pub mod note;
pub mod ask;
pub mod import;
pub mod entity;
pub mod timeline;
pub mod export;
pub mod tag;
pub mod web;
pub mod replay;
#[cfg(feature = "evif-mcp")]
pub mod evif_mcp;

pub use kb::{KnowledgeBase, KbStats};
pub use error::KbError;
pub use search::{SearchMode, SearchHit};
pub use note::NoteData;
pub use ask::{AskResult, AskCitation, ContextFragment};
pub use import::ImportResult;
pub use entity::{EntityState, EntityInfo, RelationEdge, TraverseResult, MeshStats, MemoryCardInfo};
pub use timeline::{TimelineQuery, TimelineEntry};
pub use export::{ExportData, ExportDocument, ExportFormat};
pub use tag::TagInfo;
pub use web::FetchUrlResult;
pub use replay::{SessionSummary, Checkpoint, AsOfResult};

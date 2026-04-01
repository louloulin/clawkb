export interface KbStats {
  frame_count: number;
  size_bytes: number;
  has_lex_index: boolean;
  has_vec_index: boolean;
  payload_bytes: number;
  compression_ratio_percent: number;
  path: string;
}

export interface SearchHit {
  id: string;
  title: string;
  content: string;
  score: number;
  tags: string[];
  created_at: string;
  source: string | null;
}

export interface TagInfo {
  name: string;
  count: number;
}

export interface TimelineEntry {
  id: string;
  title: string;
  timestamp: string;
  snippet: string;
}

export interface ImportResult {
  path: string;
  title: string;
  chunks: number;
  tags: string[];
  success: boolean;
  error?: string;
}

export type SearchMode = 'hybrid' | 'lex' | 'sem';
export type Page = 'dashboard' | 'search' | 'notes' | 'import' | 'timeline' | 'tags' | 'settings' | 'chat' | 'graph' | 'reader' | 'editor' | 'mindmap';

export interface FetchUrlResult {
  url: string;
  title: string;
  content_length: number;
  success: boolean;
  error?: string;
}

// AI Ask types — memvid-core built-in RAG
export interface AskCitation {
  index: number;
  frame_id: string;
  uri: string;
  score: number | null;
}

export interface ContextFragment {
  rank: number;
  frame_id: string;
  uri: string;
  title: string | null;
  score: number | null;
  text: string;
}

export interface AskResult {
  answer: string | null;
  citations: AskCitation[];
  context: ContextFragment[];
  retriever: string;
  context_only: boolean;
}

// Chat message for UI
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: AskCitation[];
  context?: ContextFragment[];
}

// Graph types — LogicMesh knowledge graph
export interface EntityInfo {
  id: number;
  display_name: string;
  canonical_name: string;
  kind: string;
  confidence: number;
  frame_ids: number[];
  mention_count: number;
}

export interface RelationEdge {
  from_id: number;
  to_id: number;
  link: string;
  confidence: number;
  frame_id: number;
}

export interface TraverseResult {
  node: string;
  kind: string;
  confidence: number;
  frame_ids: number[];
  path_length: number;
}

export interface MeshStats {
  node_count: number;
  edge_count: number;
  has_mesh: boolean;
}

export interface MemoryCardInfo {
  entity: string;
  slot: string;
  value: string;
  kind: string;
  confidence: number | null;
}

// Replay / Time Machine types
export interface SessionSummary {
  id: string;
  name: string;
  action_count: number;
  start_time: number;
  end_time: number;
}

export interface AsOfResult {
  answer: string;
  citations: AskCitation[];
  context: ContextFragment[];
  frame_cutoff: number;
  timestamp_cutoff: number;
}

// Folder types — multi-level folder system
export interface FolderInfo {
  id: string;
  name: string;
  parent_id: string | null;
  path: string;
  doc_count: number;
  created_at: number;
}
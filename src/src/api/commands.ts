import type {
  KbStats,
  SearchHit,
  TagInfo,
  TimelineEntry,
  ImportResult,
  FetchUrlResult,
  SearchMode,
  AskResult,
  EntityInfo,
  RelationEdge,
  MeshStats,
  MemoryCardInfo,
  SessionSummary,
  AsOfResult,
  SelectionResult,
  CompareResult,
  WebdavConfig,
  WebdavServerInfo,
  RemoteFile,
  SyncStatus,
  FolderInfo,
  VaultSummary,
  ObsidianImportResult,
  OcrResult,
} from './types';
import { isTauri } from './platform';

// Lazy-loaded Tauri invoke — only imported when running inside Tauri
let _invoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;

async function getInvoke() {
  if (_invoke) return _invoke;
  const { invoke } = await import('@tauri-apps/api/core');
  _invoke = invoke;
  return invoke;
}

type RawFolderInfo = {
  id: string;
  name: string;
  parent_id: string | null;
  path: string;
  doc_count: number;
  created_at: number;
};

function createImportResult(partial: Omit<ImportResult, 'auto_tags'> & { auto_tags?: string[] }): ImportResult {
  return {
    auto_tags: [],
    ...partial,
  };
}

function toFolderInfo(folder: RawFolderInfo): FolderInfo {
  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parent_id,
    path: folder.path,
    docCount: folder.doc_count,
    createdAt: folder.created_at,
  };
}

// ── Mock data for browser / preview mode ──────────────────────────────────

const DEMO_NOTES: SearchHit[] = [
  {
    id: 'demo-1',
    title: 'Getting Started with ClawKB',
    content: 'ClawKB is a local-first personal knowledge base built with Rust and Tauri. All your data stays on your machine — no cloud dependency.\n\n## Features\n- Hybrid search (lexical + semantic)\n- Tag-based organization\n- Timeline view\n- Import from files and URLs\n- Export to Markdown, HTML, or JSON',
    score: 0.95,
    tags: ['getting-started', 'features', 'overview'],
    created_at: '2026-03-30T10:00:00Z',
    source: null,
  },
  {
    id: 'demo-2',
    title: 'Search Modes Explained',
    content: 'ClawKB supports three search modes:\n\n1. **Hybrid** — combines lexical and semantic results for best accuracy\n2. **Lexical** — traditional keyword matching, fast and precise\n3. **Semantic** — AI-powered meaning-based search (requires embeddings enabled)\n\nUse hybrid as the default for most queries.',
    score: 0.88,
    tags: ['search', 'hybrid', 'lexical', 'semantic'],
    created_at: '2026-03-30T11:30:00Z',
    source: null,
  },
  {
    id: 'demo-3',
    title: 'Importing Web Pages',
    content: 'You can import web pages directly into ClawKB:\n\n1. Go to the Import page\n2. Switch to the "Web Page" tab\n3. Enter the URL and optional tags\n4. Click Fetch & Import\n\nThe page content will be extracted, stripped of boilerplate, and stored in your knowledge base.',
    score: 0.82,
    tags: ['import', 'web', 'url', 'tutorial'],
    created_at: '2026-03-30T14:00:00Z',
    source: 'https://example.com/docs',
  },
  {
    id: 'demo-4',
    title: 'Rust Performance Notes',
    content: 'The ClawKB core is written in Rust for maximum performance:\n\n- Zero-cost abstractions for memory-mapped storage\n- memvid-core provides compressed .mv2 storage format\n- Timeline queries complete in <1ms for 10k documents\n- Search latency under 50ms for typical workloads',
    score: 0.75,
    tags: ['rust', 'performance', 'architecture'],
    created_at: '2026-03-29T09:15:00Z',
    source: null,
  },
  {
    id: 'demo-5',
    title: 'Tag Best Practices',
    content: 'Tags help organize your knowledge base effectively:\n\n- Use consistent naming (lowercase, hyphenated)\n- Keep tags short and descriptive\n- Aim for 3-5 tags per document\n- Use tag hierarchy with prefixes (e.g. `project-alpha`, `project-beta`)\n- Review tags periodically to merge duplicates',
    score: 0.70,
    tags: ['tags', 'organization', 'best-practices'],
    created_at: '2026-03-29T16:45:00Z',
    source: null,
  },
];

const DEMO_TAGS: TagInfo[] = [
  { name: 'rust', count: 5 },
  { name: 'search', count: 4 },
  { name: 'import', count: 3 },
  { name: 'tags', count: 3 },
  { name: 'tutorial', count: 2 },
  { name: 'getting-started', count: 2 },
  { name: 'features', count: 2 },
  { name: 'hybrid', count: 2 },
  { name: 'performance', count: 2 },
  { name: 'organization', count: 1 },
  { name: 'best-practices', count: 1 },
  { name: 'web', count: 1 },
  { name: 'url', count: 1 },
  { name: 'architecture', count: 1 },
  { name: 'lexical', count: 1 },
  { name: 'semantic', count: 1 },
  { name: 'overview', count: 1 },
];

const DEMO_STATS: KbStats = {
  frame_count: 47,
  size_bytes: 524288,
  has_lex_index: true,
  has_vec_index: false,
  payload_bytes: 1048576,
  compression_ratio_percent: 50.0,
  path: '/demo/clawkb-demo',
};

const DEMO_TIMELINE: TimelineEntry[] = [
  { id: 'demo-1', title: 'Getting Started with ClawKB', timestamp: '2026-03-30T10:00:00Z', snippet: 'ClawKB is a local-first personal knowledge base...' },
  { id: 'demo-2', title: 'Search Modes Explained', timestamp: '2026-03-30T11:30:00Z', snippet: 'ClawKB supports three search modes...' },
  { id: 'demo-3', title: 'Importing Web Pages', timestamp: '2026-03-30T14:00:00Z', snippet: 'You can import web pages directly...' },
  { id: 'demo-4', title: 'Rust Performance Notes', timestamp: '2026-03-29T09:15:00Z', snippet: 'The ClawKB core is written in Rust...' },
  { id: 'demo-5', title: 'Tag Best Practices', timestamp: '2026-03-29T16:45:00Z', snippet: 'Tags help organize your knowledge base...' },
];

let _demoNotes = [...DEMO_NOTES];

// Demo graph data
const DEMO_ENTITIES: EntityInfo[] = [
  { id: 1, display_name: 'ClawKB', canonical_name: 'clawkb', kind: 'project', confidence: 95, frame_ids: [1, 2], mention_count: 5 },
  { id: 2, display_name: 'memvid-core', canonical_name: 'memvid-core', kind: 'project', confidence: 90, frame_ids: [1], mention_count: 3 },
  { id: 3, display_name: 'Tauri', canonical_name: 'tauri', kind: 'project', confidence: 85, frame_ids: [1], mention_count: 2 },
  { id: 4, display_name: 'React', canonical_name: 'react', kind: 'product', confidence: 80, frame_ids: [1], mention_count: 2 },
  { id: 5, display_name: 'Rust', canonical_name: 'rust', kind: 'product', confidence: 88, frame_ids: [1, 4], mention_count: 4 },
];

const DEMO_EDGES: RelationEdge[] = [
  { from_id: 1, to_id: 2, link: 'related', confidence: 90, frame_id: 1 },
  { from_id: 1, to_id: 3, link: 'related', confidence: 85, frame_id: 1 },
  { from_id: 1, to_id: 4, link: 'related', confidence: 80, frame_id: 1 },
  { from_id: 2, to_id: 5, link: 'related', confidence: 95, frame_id: 1 },
  { from_id: 3, to_id: 5, link: 'related', confidence: 80, frame_id: 1 },
];

const DEMO_MEMORIES: MemoryCardInfo[] = [
  { entity: 'clawkb', slot: 'language', value: 'Rust + TypeScript', kind: 'fact', confidence: 0.95 },
  { entity: 'clawkb', slot: 'storage', value: 'memvid-core .mv2', kind: 'fact', confidence: 0.90 },
  { entity: 'clawkb', slot: 'framework', value: 'Tauri v2', kind: 'fact', confidence: 0.85 },
];

// ── API implementation ────────────────────────────────────────────────────

export const api = {
  createKb: async (path: string): Promise<KbStats> => {
    if (!isTauri()) {
      _demoNotes = [...DEMO_NOTES];
      return { ...DEMO_STATS, path };
    }
    const invoke = await getInvoke();
    return invoke('create_kb', { path }) as Promise<KbStats>;
  },

  openKb: async (path: string): Promise<KbStats> => {
    if (!isTauri()) {
      return { ...DEMO_STATS, path };
    }
    const invoke = await getInvoke();
    return invoke('open_kb', { path }) as Promise<KbStats>;
  },

  closeKb: async (): Promise<void> => {
    if (!isTauri()) return;
    const invoke = await getInvoke();
    return invoke('close_kb') as Promise<void>;
  },

  getStats: async (): Promise<KbStats> => {
    if (!isTauri()) return DEMO_STATS;
    const invoke = await getInvoke();
    return invoke('get_stats') as Promise<KbStats>;
  },

  search: async (query: string, topK = 10, mode: SearchMode = 'hybrid'): Promise<SearchHit[]> => {
    if (!isTauri()) {
      // Simple demo search: filter by title/content match or return all
      const q = query.toLowerCase();
      const results = _demoNotes.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some(t => t.includes(q))
      );
      if (results.length === 0) return _demoNotes.slice(0, topK);
      return results.slice(0, topK);
    }
    const invoke = await getInvoke();
    return invoke('search_kb', { query, topK, mode }) as Promise<SearchHit[]>;
  },

  addNote: async (title: string, content: string, tags: string[]): Promise<string> => {
    if (!isTauri()) {
      const id = `demo-${Date.now()}`;
      _demoNotes.unshift({
        id,
        title,
        content,
        score: 1.0,
        tags,
        created_at: new Date().toISOString(),
        source: null,
      });
      return id;
    }
    const invoke = await getInvoke();
    return invoke('add_note', { title, content, tags }) as Promise<string>;
  },

  importFile: async (path: string, tags: string[]): Promise<ImportResult> => {
    if (!isTauri()) {
      const title = path.split('/').pop() || path;
      return createImportResult({ path, title, chunks: 1, tags, success: true });
    }
    const invoke = await getInvoke();
    return invoke('import_file', { path, tags }) as Promise<ImportResult>;
  },

  importDirectory: async (dirPath: string, tags: string[], recursive = false): Promise<ImportResult[]> => {
    if (!isTauri()) {
      return [createImportResult({
        path: dirPath,
        title: dirPath.split('/').pop() || dirPath,
        chunks: 3,
        tags,
        success: true,
      })];
    }
    const invoke = await getInvoke();
    return invoke('import_directory', { dirPath, tags, recursive }) as Promise<ImportResult[]>;
  },

  timeline: async (limit = 20, fromDate?: string, toDate?: string): Promise<TimelineEntry[]> => {
    if (!isTauri()) {
      return DEMO_TIMELINE.slice(0, limit);
    }
    const invoke = await getInvoke();
    return invoke('timeline_kb', { limit, fromDate: fromDate ?? null, toDate: toDate ?? null }) as Promise<TimelineEntry[]>;
  },

  listTags: async (): Promise<TagInfo[]> => {
    if (!isTauri()) return DEMO_TAGS;
    const invoke = await getInvoke();
    return invoke('list_tags') as Promise<TagInfo[]>;
  },

  renameTag: async (oldTag: string, newTag: string): Promise<{ updated: number; tag: string; related_tag: string | null }> => {
    if (!isTauri()) return { updated: 0, tag: oldTag, related_tag: newTag };
    const invoke = await getInvoke();
    return invoke('rename_tag', { oldTag, newTag }) as Promise<{ updated: number; tag: string; related_tag: string | null }>;
  },

  mergeTag: async (sourceTag: string, destTag: string): Promise<{ updated: number; tag: string; related_tag: string | null }> => {
    if (!isTauri()) return { updated: 0, tag: sourceTag, related_tag: destTag };
    const invoke = await getInvoke();
    return invoke('merge_tag', { sourceTag, destTag }) as Promise<{ updated: number; tag: string; related_tag: string | null }>;
  },

  deleteTag: async (tag: string): Promise<{ updated: number; tag: string; related_tag: string | null }> => {
    if (!isTauri()) return { updated: 0, tag, related_tag: null };
    const invoke = await getInvoke();
    return invoke('delete_tag', { tag }) as Promise<{ updated: number; tag: string; related_tag: string | null }>;
  },

  commit: async (): Promise<void> => {
    if (!isTauri()) return;
    const invoke = await getInvoke();
    return invoke('commit_kb') as Promise<void>;
  },

  export: async (format: 'md' | 'html' | 'json'): Promise<string> => {
    if (!isTauri()) {
      if (format === 'json') return JSON.stringify(_demoNotes, null, 2);
      return `# ClawKB Demo Export\n\n${_demoNotes.map(n => `## ${n.title}\n\n${n.content}`).join('\n\n')}`;
    }
    const invoke = await getInvoke();
    return invoke('export_kb', { format }) as Promise<string>;
  },

  fetchUrl: async (url: string, tags: string[]): Promise<FetchUrlResult> => {
    if (!isTauri()) {
      return { url, title: url, content_length: 1024, success: true };
    }
    const invoke = await getInvoke();
    return invoke('fetch_url', { url, tags }) as Promise<FetchUrlResult>;
  },

  // AI Ask methods — powered by memvid-core built-in RAG
  aiAsk: async (question: string, topK?: number): Promise<AskResult> => {
    if (!isTauri()) {
      const q = question.toLowerCase();
      const results = DEMO_NOTES.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some(t => t.includes(q))
      );
      const hits = results.length > 0 ? results : DEMO_NOTES;
      return {
        answer: `Based on your knowledge base, here's what I found about "${question}":\n\n${hits.slice(0, 3).map(n => `- **${n.title}**: ${n.content.slice(0, 100)}...`).join('\n')}`,
        citations: hits.slice(0, 5).map((hit, idx) => ({
          index: idx,
          frame_id: hit.id,
          uri: hit.source || '',
          score: hit.score,
        })),
        context: hits.slice(0, 5).map((hit, idx) => ({
          rank: idx + 1,
          frame_id: hit.id,
          uri: hit.source || '',
          title: hit.title,
          score: hit.score,
          text: hit.content.slice(0, 200),
        })),
        retriever: 'hybrid',
        context_only: false,
      };
    }
    const invoke = await getInvoke();
    return invoke('ai_ask', { question, topK }) as Promise<AskResult>;
  },

  aiAskContext: async (question: string, topK?: number): Promise<AskResult> => {
    if (!isTauri()) {
      const q = question.toLowerCase();
      const results = DEMO_NOTES.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some(t => t.includes(q))
      );
      const hits = results.length > 0 ? results : DEMO_NOTES;
      return {
        answer: null,
        citations: [],
        context: hits.slice(0, topK || 10).map((hit, idx) => ({
          rank: idx + 1,
          frame_id: hit.id,
          uri: hit.source || '',
          title: hit.title,
          score: hit.score,
          text: hit.content.slice(0, 300),
        })),
        retriever: 'hybrid',
        context_only: true,
      };
    }
    const invoke = await getInvoke();
    return invoke('ai_ask_context', { question, topK }) as Promise<AskResult>;
  },

  // Document-scoped AI ask — limit search to a specific document URI
  askDocument: async (question: string, documentUri: string, topK?: number): Promise<AskResult> => {
    if (!isTauri()) {
      const doc = DEMO_NOTES.find(n => n.id === documentUri || n.source === documentUri)
        || DEMO_NOTES[0];
      return {
        answer: `Based on the document "${doc.title}":\n\n${doc.content.slice(0, 300)}...\n\nThis document covers ${doc.tags.join(', ')}.`,
        citations: [{ index: 0, frame_id: doc.id, uri: doc.source || documentUri, score: 0.95 }],
        context: [{
          rank: 1, frame_id: doc.id, uri: doc.source || documentUri,
          title: doc.title, score: 0.95, text: doc.content,
        }],
        retriever: 'hybrid',
        context_only: false,
      };
    }
    const invoke = await getInvoke();
    return invoke('ask_document', { question, documentUri, topK }) as Promise<AskResult>;
  },

  // ── Graph / LogicMesh API ──────────────────────────────────────────
  listEntities: async (kind?: string): Promise<EntityInfo[]> => {
    if (!isTauri()) {
      return DEMO_ENTITIES.filter(e => !kind || e.kind === kind);
    }
    const invoke = await getInvoke();
    return invoke('list_entities', { kind: kind || null }) as Promise<EntityInfo[]>;
  },

  getEntityEdges: async (entityId: number): Promise<RelationEdge[]> => {
    if (!isTauri()) {
      return DEMO_EDGES.filter(e => e.from_id === entityId || e.to_id === entityId);
    }
    const invoke = await getInvoke();
    return invoke('get_entity', { entityId }) as Promise<RelationEdge[]>;
  },

  traverseGraph: async (start: string, link: string, hops: number): Promise<EntityInfo[]> => {
    if (!isTauri()) {
      return DEMO_ENTITIES.slice(0, 5);
    }
    const invoke = await getInvoke();
    return invoke('traverse_graph', { start, link, hops }) as Promise<EntityInfo[]>;
  },

  getMeshStats: async (): Promise<MeshStats> => {
    if (!isTauri()) {
      return { node_count: DEMO_ENTITIES.length, edge_count: DEMO_EDGES.length, has_mesh: true };
    }
    const invoke = await getInvoke();
    return invoke('get_mesh_stats') as Promise<MeshStats>;
  },

  listMemories: async (): Promise<MemoryCardInfo[]> => {
    if (!isTauri()) {
      return DEMO_MEMORIES;
    }
    const invoke = await getInvoke();
    return invoke('list_memories') as Promise<MemoryCardInfo[]>;
  },

  // ── Replay / Time Machine ──

  listSessions: async (): Promise<SessionSummary[]> => {
    if (!isTauri()) {
      return [
        { id: 's1', name: 'Research Session', action_count: 12, start_time: Date.now() - 86400000, end_time: Date.now() - 3600000 },
        { id: 's2', name: 'Import Session', action_count: 5, start_time: Date.now() - 172800000, end_time: Date.now() - 86400000 },
      ];
    }
    const invoke = await getInvoke();
    return invoke('list_sessions') as Promise<SessionSummary[]>;
  },

  searchAsOf: async (query: string, asOfTs: number, topK?: number): Promise<SearchHit[]> => {
    if (!isTauri()) {
      return [
        { id: '1', title: 'Historical Note', content: 'This is how the KB looked at that point in time...', score: 0.85, tags: ['research'], created_at: new Date(asOfTs).toISOString(), source: null },
      ];
    }
    const invoke = await getInvoke();
    return invoke('search_as_of', { query, asOfTs, topK: topK || 10 }) as Promise<SearchHit[]>;
  },

  askAsOf: async (question: string, asOfTs: number, topK?: number): Promise<AsOfResult> => {
    if (!isTauri()) {
      return {
        answer: 'Based on the state of the knowledge base at that time, here is what was known...',
        citations: [],
        context: [],
        frame_cutoff: 0,
        timestamp_cutoff: asOfTs,
      };
    }
    const invoke = await getInvoke();
    return invoke('ask_as_of', { question, asOfTs, topK: topK || 8 }) as Promise<AsOfResult>;
  },

  compareTimeline: async (query: string, earlierTs: number, laterTs: number, topK?: number): Promise<CompareResult> => {
    if (!isTauri()) {
      return {
        earlier_timestamp: earlierTs,
        later_timestamp: laterTs,
        earlier_hits: [],
        later_hits: [],
        query,
      };
    }
    const invoke = await getInvoke();
    return invoke('compare_timeline', { query, earlierTs, laterTs, topK: topK || 20 }) as Promise<CompareResult>;
  },

  // ── AI Configuration ──

  setEmbeddingModel: async (provider: string, model: string, apiKey?: string, apiBase?: string): Promise<void> => {
    if (!isTauri()) return;
    const invoke = await getInvoke();
    return invoke('set_embedding_model', { provider, model, apiKey: apiKey || null, apiBase: apiBase || null }) as Promise<void>;
  },

  setAskModel: async (provider: string, model: string, apiKey?: string, apiBase?: string, temperature?: number): Promise<void> => {
    if (!isTauri()) return;
    const invoke = await getInvoke();
    return invoke('set_ask_model', { provider, model, apiKey: apiKey || null, apiBase: apiBase || null, temperature: temperature ?? 0.7 }) as Promise<void>;
  },

  testLlmConnection: async (): Promise<string> => {
    if (!isTauri()) return 'ok';
    const invoke = await getInvoke();
    return invoke('test_llm') as Promise<string>;
  },

  // ── Multimedia Import ──

  importAudio: async (path: string, tags: string[]): Promise<ImportResult> => {
    if (!isTauri()) {
      const title = path.split('/').pop() || 'audio';
      return createImportResult({ path, title, chunks: 1, tags, success: true });
    }
    const invoke = await getInvoke();
    return invoke('import_audio', { path, tags }) as Promise<ImportResult>;
  },

  importImage: async (path: string, tags: string[]): Promise<ImportResult> => {
    if (!isTauri()) {
      const title = path.split('/').pop() || 'image';
      return createImportResult({ path, title, chunks: 1, tags, success: true });
    }
    const invoke = await getInvoke();
    return invoke('import_image', { path, tags }) as Promise<ImportResult>;
  },

  // ── Graph Pattern Search ──

  searchWithGraph: async (query: string, graphPattern: string, topK?: number, mode?: SearchMode): Promise<SearchHit[]> => {
    if (!isTauri()) {
      const q = query.toLowerCase();
      const results = _demoNotes.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some(t => t.includes(q))
      );
      return results.slice(0, topK || 10);
    }
    const invoke = await getInvoke();
    return invoke('search_with_graph', { query, graphPattern, topK: topK || 10, mode: mode || 'hybrid' }) as Promise<SearchHit[]>;
  },

  // ── Folder Management ──

  listFolders: async (): Promise<FolderInfo[]> => {
    if (!isTauri()) {
      return _demoFolders;
    }
    const invoke = await getInvoke();
    const folders = await invoke('list_folders', {}) as RawFolderInfo[];
    return folders.map(toFolderInfo);
  },

  createFolder: async (name: string, parentId?: string | null): Promise<FolderInfo> => {
    if (!isTauri()) {
      const id = `folder-${Date.now()}`;
      return {
        id,
        name,
        parentId: parentId || null,
        path: `/${name}`,
        docCount: 0,
        createdAt: Date.now() / 1000,
      };
    }
    const invoke = await getInvoke();
    const folder = await invoke('create_folder', { name, parent_id: parentId || null }) as RawFolderInfo;
    return toFolderInfo(folder);
  },

  renameFolder: async (folderId: string, newName: string): Promise<void> => {
    if (!isTauri()) return;
    const invoke = await getInvoke();
    return invoke('rename_folder', { folder_id: folderId, new_name: newName }) as Promise<void>;
  },

  deleteFolder: async (folderId: string): Promise<void> => {
    if (!isTauri()) return;
    const invoke = await getInvoke();
    return invoke('delete_folder', { folder_id: folderId }) as Promise<void>;
  },

  moveDocument: async (docId: string, folderId: string | null): Promise<void> => {
    if (!isTauri()) return;
    const invoke = await getInvoke();
    return invoke('move_document', { doc_id: docId, folder_id: folderId }) as Promise<void>;
  },

  searchInFolder: async (folderId: string, query: string, topK?: number, mode?: SearchMode): Promise<SearchHit[]> => {
    if (!isTauri()) {
      const q = query.toLowerCase();
      return _demoNotes.filter(n =>
        (n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)) &&
        n.tags.some(t => t.includes(folderId))
      ).slice(0, topK || 10);
    }
    const invoke = await getInvoke();
    return invoke('search_in_folder', { folder_id: folderId, query, top_k: topK || 10, mode: mode || 'hybrid' }) as Promise<SearchHit[]>;
  },

  // ── Obsidian Sync ──

  scanObsidianVault: async (vaultPath: string): Promise<VaultSummary> => {
    if (!isTauri()) {
      return { root_path: vaultPath, total_notes: 0, total_tags: 0, folders: [], sample_tags: [] };
    }
    const invoke = await getInvoke();
    return invoke('scan_obsidian_vault', { vaultPath }) as Promise<VaultSummary>;
  },

  importObsidianVault: async (vaultPath: string, tags: string[]): Promise<ObsidianImportResult> => {
    if (!isTauri()) {
      return { imported: 0, skipped: 0, errors: [] };
    }
    const invoke = await getInvoke();
    return invoke('import_obsidian_vault', { vaultPath, tags }) as Promise<ObsidianImportResult>;
  },

  // ── Screenshot OCR ──

  ocrImage: async (imageData: string, language?: string): Promise<OcrResult> => {
    if (!isTauri()) {
      return { text: '', success: false, error: 'OCR only available in Tauri mode', language: language || 'eng', confidence: null };
    }
    const invoke = await getInvoke();
    return invoke('ocr_image', { imageData, language: language || null }) as Promise<OcrResult>;
  },

  testOcr: async (): Promise<string> => {
    if (!isTauri()) return 'ok';
    const invoke = await getInvoke();
    return invoke('test_ocr') as Promise<string>;
  },

  importScreenshot: async (imageData: string, title: string, tags: string[], language?: string): Promise<ImportResult> => {
    if (!isTauri()) {
      return createImportResult({
        path: 'clipboard:screenshot',
        title: title || 'Screenshot',
        chunks: 1,
        tags: ['screenshot', 'ocr', ...tags],
        success: true,
      });
    }
    const invoke = await getInvoke();
    return invoke('import_screenshot', {
      imageData,
      title: title || '',
      tags,
      language: language || null,
    }) as Promise<ImportResult>;
  },

  // ── Selection AI ──

  selectionAi: async (action: 'explain' | 'translate' | 'rewrite' | 'summarize' | 'ask', text: string): Promise<SelectionResult> => {
    if (!isTauri()) {
      return {
        action,
        input: text,
        output: `[Demo] ${action} result for: "${text.slice(0, 50)}..."`,
        success: true,
        error: null,
      };
    }
    const invoke = await getInvoke();
    return invoke('selection_ai', { action, text }) as Promise<SelectionResult>;
  },

  // ── WebDAV Sync ──

  webdavTestConnection: async (config: WebdavConfig): Promise<WebdavServerInfo> => {
    if (!isTauri()) {
      return { url: config.url, server_type: 'Demo WebDAV', supports_sync: true };
    }
    const invoke = await getInvoke();
    return invoke('webdav_test_connection', { config }) as Promise<WebdavServerInfo>;
  },

  webdavListRemote: async (config: WebdavConfig, remoteDir?: string): Promise<RemoteFile[]> => {
    if (!isTauri()) return [];
    const invoke = await getInvoke();
    return invoke('webdav_list_remote', { config, remoteDir: remoteDir || null }) as Promise<RemoteFile[]>;
  },

  webdavSaveConfig: async (config: WebdavConfig, kbPath?: string): Promise<void> => {
    if (!isTauri()) return;
    const invoke = await getInvoke();
    return invoke('webdav_save_config', { config, kbPath: kbPath || null }) as Promise<void>;
  },

  webdavGetConfig: async (): Promise<WebdavConfig | null> => {
    if (!isTauri()) return null;
    const invoke = await getInvoke();
    return invoke('webdav_get_config', {}) as Promise<WebdavConfig | null>;
  },

  webdavSync: async (): Promise<SyncStatus> => {
    if (!isTauri()) {
      return {
        last_sync: Date.now() / 1000 - 3600,
        remote_count: 1,
        local_count: 1,
        pending_uploads: 0,
        pending_downloads: 0,
        last_error: null,
        uploads: [],
        downloads: [],
        skipped: [],
      };
    }
    const invoke = await getInvoke();
    return invoke('webdav_sync_kb', {}) as Promise<SyncStatus>;
  },

  webdavGetSyncStatus: async (): Promise<SyncStatus | null> => {
    if (!isTauri()) return null;
    const invoke = await getInvoke();
    return invoke('webdav_get_sync_status', {}) as Promise<SyncStatus | null>;
  },

  webdavClearConfig: async (): Promise<void> => {
    if (!isTauri()) return;
    const invoke = await getInvoke();
    return invoke('webdav_clear_config', {}) as Promise<void>;
  },

  // ── Multi-KB Commands ──

  openExtraKb: async (path: string): Promise<KbStats> => {
    if (!isTauri()) {
      return { frame_count: 10, size_bytes: 1024000, has_lex_index: true, has_vec_index: true, payload_bytes: 512000, compression_ratio_percent: 50, path };
    }
    const invoke = await getInvoke();
    return invoke('open_extra_kb', { path }) as Promise<KbStats>;
  },

  closeExtraKb: async (path: string): Promise<void> => {
    if (!isTauri()) return;
    const invoke = await getInvoke();
    return invoke('close_extra_kb', { path }) as Promise<void>;
  },

  listOpenKbs: async (): Promise<string[]> => {
    if (!isTauri()) return [];
    const invoke = await getInvoke();
    return invoke('list_open_kbs', {}) as Promise<string[]>;
  },

  searchMultiKb: async (query: string, kbPaths: string[], topK?: number, mode?: SearchMode): Promise<SearchHit[]> => {
    if (!isTauri()) {
      const q = query.toLowerCase();
      const prefix = kbPaths.length > 1 ? '[Multi]' : `[${kbPaths[0]?.split('/').pop() || 'KB'}]`;
      const hits = _demoNotes
        .filter((note) =>
          q === '*' ||
          note.title.toLowerCase().includes(q) ||
          note.content.toLowerCase().includes(q) ||
          note.tags.some((tag) => tag.includes(q))
        );
      const results = hits.length > 0 ? hits : _demoNotes;
      return results
        .slice(0, topK || 10)
        .map((note) => ({ ...note, source: note.source || prefix }));
    }
    const invoke = await getInvoke();
    return invoke('search_multi_kb', { query, kbPaths, topK: topK || 10, mode: mode || 'hybrid' }) as Promise<SearchHit[]>;
  },

  aiAskMulti: async (question: string, kbPaths: string[], topK?: number): Promise<{ kb_name: string; kb_path: string; result: AskResult }> => {
    if (!isTauri()) {
      return { kb_name: 'Default', kb_path: '', result: { answer: `[Demo] Answer from default KB for: "${question}"`, citations: [], context: [], retriever: 'demo', context_only: false } };
    }
    const invoke = await getInvoke();
    return invoke('ai_ask_multi', { question, kbPaths, topK: topK || 5 }) as Promise<{ kb_name: string; kb_path: string; result: AskResult }>;
  },
};

// Demo data for folders
const _demoFolders: FolderInfo[] = [
  { id: 'folder-work', name: 'Work', parentId: null, path: '/Work', docCount: 5, createdAt: Date.now() / 1000 - 86400 },
  { id: 'folder-projectA', name: 'Project A', parentId: 'folder-work', path: '/Work/Project A', docCount: 3, createdAt: Date.now() / 1000 - 72000 },
  { id: 'folder-projectB', name: 'Project B', parentId: 'folder-work', path: '/Work/Project B', docCount: 2, createdAt: Date.now() / 1000 - 36000 },
  { id: 'folder-study', name: 'Study', parentId: null, path: '/Study', docCount: 8, createdAt: Date.now() / 1000 - 172800 },
  { id: 'folder-life', name: 'Life', parentId: null, path: '/Life', docCount: 12, createdAt: Date.now() / 1000 - 259200 },
];

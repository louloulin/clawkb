import type { KbStats, SearchHit, TagInfo, TimelineEntry, ImportResult, FetchUrlResult, SearchMode, AskResult, EntityInfo, RelationEdge, MeshStats, MemoryCardInfo, SessionSummary, AsOfResult } from './types';
import { isTauri } from './platform';

// Lazy-loaded Tauri invoke — only imported when running inside Tauri
let _invoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;

async function getInvoke() {
  if (_invoke) return _invoke;
  const { invoke } = await import('@tauri-apps/api/core');
  _invoke = invoke;
  return invoke;
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
      return { path, title, chunks: 1, tags, success: true };
    }
    const invoke = await getInvoke();
    return invoke('import_file', { path, tags }) as Promise<ImportResult>;
  },

  importDirectory: async (dirPath: string, tags: string[], recursive = false): Promise<ImportResult[]> => {
    if (!isTauri()) {
      return [{ path: dirPath, title: dirPath.split('/').pop() || dirPath, chunks: 3, tags, success: true }];
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
      return {
        answer: null,
        citations: [],
        context: results.slice(0, topK || 10).map((hit, idx) => ({
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
};

import type {
  AskResult,
  AsOfResult,
  CompareResult,
  EntityInfo,
  FetchUrlResult,
  FolderInfo,
  ImportResult,
  KbStats,
  MemoryCardInfo,
  MeshStats,
  ObsidianImportResult,
  OcrResult,
  RelationEdge,
  RemoteFile,
  SearchHit,
  SearchMode,
  SelectionResult,
  SessionSummary,
  SyncStatus,
  TagInfo,
  TimelineEntry,
  VaultSummary,
  WebdavConfig,
  WebdavServerInfo,
} from './types';
import { isTauri } from './platform';

const DESKTOP_RUNTIME_REQUIRED_MESSAGE =
  'ClawKB desktop runtime required. Open the Tauri desktop app to use local knowledge base features.';

let invokeCache: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;

type RawFolderInfo = {
  id: string;
  name: string;
  parent_id: string | null;
  path: string;
  doc_count: number;
  created_at: number;
};

function createDesktopRuntimeError() {
  return new Error(DESKTOP_RUNTIME_REQUIRED_MESSAGE);
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

async function getDesktopInvoke() {
  if (!isTauri()) {
    throw createDesktopRuntimeError();
  }
  if (invokeCache) {
    return invokeCache;
  }

  const { invoke } = await import('@tauri-apps/api/core');
  invokeCache = invoke;
  return invoke;
}

export const api = {
  async createKb(path: string): Promise<KbStats> {
    const invoke = await getDesktopInvoke();
    return invoke('create_kb', { path }) as Promise<KbStats>;
  },

  async openKb(path: string): Promise<KbStats> {
    const invoke = await getDesktopInvoke();
    return invoke('open_kb', { path }) as Promise<KbStats>;
  },

  async closeKb(): Promise<void> {
    const invoke = await getDesktopInvoke();
    return invoke('close_kb') as Promise<void>;
  },

  async getStats(): Promise<KbStats> {
    const invoke = await getDesktopInvoke();
    return invoke('get_stats') as Promise<KbStats>;
  },

  async search(query: string, topK = 10, mode: SearchMode = 'hybrid'): Promise<SearchHit[]> {
    const invoke = await getDesktopInvoke();
    return invoke('search_kb', { query, topK, mode }) as Promise<SearchHit[]>;
  },

  async addNote(title: string, content: string, tags: string[]): Promise<string> {
    const invoke = await getDesktopInvoke();
    return invoke('add_note', { title, content, tags }) as Promise<string>;
  },

  async getNote(noteId: string): Promise<{ id: string; path: string; title: string; content: string; tags: string[]; created_at: string; updated_at: string }> {
    const invoke = await getDesktopInvoke();
    return invoke('get_note', { note_id: noteId }) as Promise<{ id: string; path: string; title: string; content: string; tags: string[]; created_at: string; updated_at: string }>;
  },

  async listNotes(tag?: string, limit?: number): Promise<Array<{ id: string; path: string; title: string; content: string; tags: string[]; created_at: string; updated_at: string }>> {
    const invoke = await getDesktopInvoke();
    return invoke('list_notes', { tag: tag ?? null, limit: limit ?? 100 }) as Promise<Array<{ id: string; path: string; title: string; content: string; tags: string[]; created_at: string; updated_at: string }>>;
  },

  async renameNote(noteId: string, newTitle: string): Promise<{ id: string; path: string; title: string; content: string; tags: string[]; created_at: string; updated_at: string }> {
    const invoke = await getDesktopInvoke();
    return invoke('rename_note', { note_id: noteId, new_title: newTitle }) as Promise<{ id: string; path: string; title: string; content: string; tags: string[]; created_at: string; updated_at: string }>;
  },

  async deleteNote(noteId: string): Promise<void> {
    const invoke = await getDesktopInvoke();
    return invoke('delete_note', { note_id: noteId }) as Promise<void>;
  },

  async updateNote(
    noteId: string,
    title?: string,
    content?: string,
    tags?: string[],
  ): Promise<{ id: string; path: string; title: string; content: string; tags: string[]; created_at: string; updated_at: string }> {
    const invoke = await getDesktopInvoke();
    return invoke('update_note', {
      note_id: noteId,
      title: title ?? null,
      content: content ?? null,
      tags: tags ?? null,
    }) as Promise<{ id: string; path: string; title: string; content: string; tags: string[]; created_at: string; updated_at: string }>;
  },

  async importFile(path: string, tags: string[]): Promise<ImportResult> {
    const invoke = await getDesktopInvoke();
    return invoke('import_file', { path, tags }) as Promise<ImportResult>;
  },

  async importDirectory(
    dirPath: string,
    tags: string[],
    recursive = false,
  ): Promise<ImportResult[]> {
    const invoke = await getDesktopInvoke();
    return invoke('import_directory', { dirPath, tags, recursive }) as Promise<ImportResult[]>;
  },

  async timeline(limit = 20, fromDate?: string, toDate?: string): Promise<TimelineEntry[]> {
    const invoke = await getDesktopInvoke();
    return invoke('timeline_kb', {
      limit,
      fromDate: fromDate ?? null,
      toDate: toDate ?? null,
    }) as Promise<TimelineEntry[]>;
  },

  async listTags(): Promise<TagInfo[]> {
    const invoke = await getDesktopInvoke();
    return invoke('list_tags') as Promise<TagInfo[]>;
  },

  async renameTag(
    oldTag: string,
    newTag: string,
  ): Promise<{ updated: number; tag: string; related_tag: string | null }> {
    const invoke = await getDesktopInvoke();
    return invoke('rename_tag', { oldTag, newTag }) as Promise<{
      updated: number;
      tag: string;
      related_tag: string | null;
    }>;
  },

  async mergeTag(
    sourceTag: string,
    destTag: string,
  ): Promise<{ updated: number; tag: string; related_tag: string | null }> {
    const invoke = await getDesktopInvoke();
    return invoke('merge_tag', { sourceTag, destTag }) as Promise<{
      updated: number;
      tag: string;
      related_tag: string | null;
    }>;
  },

  async deleteTag(
    tag: string,
  ): Promise<{ updated: number; tag: string; related_tag: string | null }> {
    const invoke = await getDesktopInvoke();
    return invoke('delete_tag', { tag }) as Promise<{
      updated: number;
      tag: string;
      related_tag: string | null;
    }>;
  },

  async commit(): Promise<void> {
    const invoke = await getDesktopInvoke();
    return invoke('commit_kb') as Promise<void>;
  },

  async export(format: 'md' | 'html' | 'json'): Promise<string> {
    const invoke = await getDesktopInvoke();
    return invoke('export_kb', { format }) as Promise<string>;
  },

  async fetchUrl(url: string, tags: string[]): Promise<FetchUrlResult> {
    const invoke = await getDesktopInvoke();
    return invoke('fetch_url', { url, tags }) as Promise<FetchUrlResult>;
  },

  async aiAsk(question: string, topK?: number): Promise<AskResult> {
    const invoke = await getDesktopInvoke();
    return invoke('ai_ask', { question, topK }) as Promise<AskResult>;
  },

  async aiAskContext(question: string, topK?: number): Promise<AskResult> {
    const invoke = await getDesktopInvoke();
    return invoke('ai_ask_context', { question, topK }) as Promise<AskResult>;
  },

  async askDocument(
    question: string,
    documentUri: string,
    topK?: number,
  ): Promise<AskResult> {
    const invoke = await getDesktopInvoke();
    return invoke('ask_document', { question, documentUri, topK }) as Promise<AskResult>;
  },

  async listEntities(kind?: string): Promise<EntityInfo[]> {
    const invoke = await getDesktopInvoke();
    return invoke('list_entities', { kind: kind ?? null }) as Promise<EntityInfo[]>;
  },

  async getEntityEdges(entityId: number): Promise<RelationEdge[]> {
    const invoke = await getDesktopInvoke();
    return invoke('get_entity', { entityId }) as Promise<RelationEdge[]>;
  },

  async traverseGraph(start: string, link: string, hops: number): Promise<EntityInfo[]> {
    const invoke = await getDesktopInvoke();
    return invoke('traverse_graph', { start, link, hops }) as Promise<EntityInfo[]>;
  },

  async getMeshStats(): Promise<MeshStats> {
    const invoke = await getDesktopInvoke();
    return invoke('get_mesh_stats') as Promise<MeshStats>;
  },

  async listMemories(): Promise<MemoryCardInfo[]> {
    const invoke = await getDesktopInvoke();
    return invoke('list_memories') as Promise<MemoryCardInfo[]>;
  },

  async listSessions(): Promise<SessionSummary[]> {
    const invoke = await getDesktopInvoke();
    return invoke('list_sessions') as Promise<SessionSummary[]>;
  },

  async searchAsOf(query: string, asOfTs: number, topK?: number): Promise<SearchHit[]> {
    const invoke = await getDesktopInvoke();
    return invoke('search_as_of', {
      query,
      asOfTs,
      topK: topK ?? 10,
    }) as Promise<SearchHit[]>;
  },

  async askAsOf(question: string, asOfTs: number, topK?: number): Promise<AsOfResult> {
    const invoke = await getDesktopInvoke();
    return invoke('ask_as_of', {
      question,
      asOfTs,
      topK: topK ?? 8,
    }) as Promise<AsOfResult>;
  },

  async compareTimeline(
    query: string,
    earlierTs: number,
    laterTs: number,
    topK?: number,
  ): Promise<CompareResult> {
    const invoke = await getDesktopInvoke();
    return invoke('compare_timeline', {
      query,
      earlierTs,
      laterTs,
      topK: topK ?? 20,
    }) as Promise<CompareResult>;
  },

  async setEmbeddingModel(
    provider: string,
    model: string,
    apiKey?: string,
    apiBase?: string,
  ): Promise<void> {
    const invoke = await getDesktopInvoke();
    return invoke('set_embedding_model', {
      provider,
      model,
      apiKey: apiKey ?? null,
      apiBase: apiBase ?? null,
    }) as Promise<void>;
  },

  async setAskModel(
    provider: string,
    model: string,
    apiKey?: string,
    apiBase?: string,
    temperature?: number,
  ): Promise<void> {
    const invoke = await getDesktopInvoke();
    return invoke('set_ask_model', {
      provider,
      model,
      apiKey: apiKey ?? null,
      apiBase: apiBase ?? null,
      temperature: temperature ?? 0.7,
    }) as Promise<void>;
  },

  async testLlmConnection(): Promise<string> {
    const invoke = await getDesktopInvoke();
    return invoke('test_llm') as Promise<string>;
  },

  async importAudio(path: string, tags: string[]): Promise<ImportResult> {
    const invoke = await getDesktopInvoke();
    return invoke('import_audio', { path, tags }) as Promise<ImportResult>;
  },

  async importImage(path: string, tags: string[]): Promise<ImportResult> {
    const invoke = await getDesktopInvoke();
    return invoke('import_image', { path, tags }) as Promise<ImportResult>;
  },

  async searchWithGraph(
    query: string,
    graphPattern: string,
    topK?: number,
    mode?: SearchMode,
  ): Promise<SearchHit[]> {
    const invoke = await getDesktopInvoke();
    return invoke('search_with_graph', {
      query,
      graphPattern,
      topK: topK ?? 10,
      mode: mode ?? 'hybrid',
    }) as Promise<SearchHit[]>;
  },

  async listFolders(): Promise<FolderInfo[]> {
    const invoke = await getDesktopInvoke();
    const folders = (await invoke('list_folders', {})) as RawFolderInfo[];
    return folders.map(toFolderInfo);
  },

  async createFolder(name: string, parentId?: string | null): Promise<FolderInfo> {
    const invoke = await getDesktopInvoke();
    const folder = (await invoke('create_folder', {
      name,
      parent_id: parentId ?? null,
    })) as RawFolderInfo;
    return toFolderInfo(folder);
  },

  async renameFolder(folderId: string, newName: string): Promise<void> {
    const invoke = await getDesktopInvoke();
    return invoke('rename_folder', {
      folder_id: folderId,
      new_name: newName,
    }) as Promise<void>;
  },

  async deleteFolder(folderId: string): Promise<void> {
    const invoke = await getDesktopInvoke();
    return invoke('delete_folder', { folder_id: folderId }) as Promise<void>;
  },

  async moveDocument(docId: string, folderId: string | null): Promise<void> {
    const invoke = await getDesktopInvoke();
    return invoke('move_document', { doc_id: docId, folder_id: folderId }) as Promise<void>;
  },

  async searchInFolder(
    folderId: string,
    query: string,
    topK?: number,
    mode?: SearchMode,
  ): Promise<SearchHit[]> {
    const invoke = await getDesktopInvoke();
    return invoke('search_in_folder', {
      folder_id: folderId,
      query,
      top_k: topK ?? 10,
      mode: mode ?? 'hybrid',
    }) as Promise<SearchHit[]>;
  },

  async setDocumentTags(docId: string, tags: string[]): Promise<void> {
    const invoke = await getDesktopInvoke();
    return invoke('set_document_tags', { doc_id: docId, tags }) as Promise<void>;
  },

  async scanObsidianVault(vaultPath: string): Promise<VaultSummary> {
    const invoke = await getDesktopInvoke();
    return invoke('scan_obsidian_vault', { vaultPath }) as Promise<VaultSummary>;
  },

  async importObsidianVault(
    vaultPath: string,
    tags: string[],
  ): Promise<ObsidianImportResult> {
    const invoke = await getDesktopInvoke();
    return invoke('import_obsidian_vault', { vaultPath, tags }) as Promise<ObsidianImportResult>;
  },

  async ocrImage(imageData: string, language?: string): Promise<OcrResult> {
    const invoke = await getDesktopInvoke();
    return invoke('ocr_image', {
      imageData,
      language: language ?? null,
    }) as Promise<OcrResult>;
  },

  async testOcr(): Promise<string> {
    const invoke = await getDesktopInvoke();
    return invoke('test_ocr') as Promise<string>;
  },

  async importScreenshot(
    imageData: string,
    title: string,
    tags: string[],
    language?: string,
  ): Promise<ImportResult> {
    const invoke = await getDesktopInvoke();
    return invoke('import_screenshot', {
      imageData,
      title: title || '',
      tags,
      language: language ?? null,
    }) as Promise<ImportResult>;
  },

  async selectionAi(
    action: 'explain' | 'translate' | 'rewrite' | 'summarize' | 'ask',
    text: string,
  ): Promise<SelectionResult> {
    const invoke = await getDesktopInvoke();
    return invoke('selection_ai', { action, text }) as Promise<SelectionResult>;
  },

  async webdavTestConnection(config: WebdavConfig): Promise<WebdavServerInfo> {
    const invoke = await getDesktopInvoke();
    return invoke('webdav_test_connection', { config }) as Promise<WebdavServerInfo>;
  },

  async webdavListRemote(
    config: WebdavConfig,
    remoteDir?: string,
  ): Promise<RemoteFile[]> {
    const invoke = await getDesktopInvoke();
    return invoke('webdav_list_remote', {
      config,
      remoteDir: remoteDir ?? null,
    }) as Promise<RemoteFile[]>;
  },

  async webdavSaveConfig(config: WebdavConfig, kbPath?: string): Promise<void> {
    const invoke = await getDesktopInvoke();
    return invoke('webdav_save_config', {
      config,
      kbPath: kbPath ?? null,
    }) as Promise<void>;
  },

  async webdavGetConfig(): Promise<WebdavConfig | null> {
    const invoke = await getDesktopInvoke();
    return invoke('webdav_get_config', {}) as Promise<WebdavConfig | null>;
  },

  async webdavSync(): Promise<SyncStatus> {
    const invoke = await getDesktopInvoke();
    return invoke('webdav_sync_kb', {}) as Promise<SyncStatus>;
  },

  async webdavGetSyncStatus(): Promise<SyncStatus | null> {
    const invoke = await getDesktopInvoke();
    return invoke('webdav_get_sync_status', {}) as Promise<SyncStatus | null>;
  },

  async webdavClearConfig(): Promise<void> {
    const invoke = await getDesktopInvoke();
    return invoke('webdav_clear_config', {}) as Promise<void>;
  },

  async openExtraKb(path: string): Promise<KbStats> {
    const invoke = await getDesktopInvoke();
    return invoke('open_extra_kb', { path }) as Promise<KbStats>;
  },

  async closeExtraKb(path: string): Promise<void> {
    const invoke = await getDesktopInvoke();
    return invoke('close_extra_kb', { path }) as Promise<void>;
  },

  async listOpenKbs(): Promise<string[]> {
    const invoke = await getDesktopInvoke();
    return invoke('list_open_kbs', {}) as Promise<string[]>;
  },

  async searchMultiKb(
    query: string,
    kbPaths: string[],
    topK?: number,
    mode?: SearchMode,
  ): Promise<SearchHit[]> {
    const invoke = await getDesktopInvoke();
    return invoke('search_multi_kb', {
      query,
      kbPaths,
      topK: topK ?? 10,
      mode: mode ?? 'hybrid',
    }) as Promise<SearchHit[]>;
  },

  async aiAskMulti(
    question: string,
    kbPaths: string[],
    topK?: number,
  ): Promise<{ kb_name: string; kb_path: string; result: AskResult }> {
    const invoke = await getDesktopInvoke();
    return invoke('ai_ask_multi', {
      question,
      kbPaths,
      topK: topK ?? 5,
    }) as Promise<{ kb_name: string; kb_path: string; result: AskResult }>;
  },
};

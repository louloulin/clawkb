import { create } from 'zustand';
import { api } from '@/api';
import type { SearchHit } from '@/api';

export type DocumentWorkspaceTab = 'reader' | 'draft' | 'notes' | 'report' | 'podcast';

interface DocumentWorkspaceState {
  documents: SearchHit[];
  selectedDocument: SearchHit | null;
  activeTab: DocumentWorkspaceTab;
  isLoading: boolean;
  draftTitle: string;
  draftContent: string;
  lastSavedAt: string | null;
  loadDocuments: () => Promise<void>;
  selectDocument: (doc: SearchHit) => void;
  setActiveTab: (tab: DocumentWorkspaceTab) => void;
  setDraftState: (title: string, content: string) => void;
  seedDraftFromDocument: (doc: SearchHit | null) => void;
  saveDraftToKnowledgeBase: () => Promise<string>;
}

function buildDraftTitle(doc: SearchHit | null) {
  if (!doc) return 'Untitled Workspace Draft';
  return `${doc.title} · Draft`;
}

function buildDraftContent(doc: SearchHit | null) {
  if (!doc) return '';
  const sourceLine = doc.source ? `Source: ${doc.source}` : 'Source: knowledge base document';
  return `# ${doc.title}\n\n${sourceLine}\n\n---\n\n${doc.content}`;
}

export const useDocumentWorkspaceStore = create<DocumentWorkspaceState>((set, get) => ({
  documents: [],
  selectedDocument: null,
  activeTab: 'reader',
  isLoading: false,
  draftTitle: 'Untitled Workspace Draft',
  draftContent: '',
  lastSavedAt: null,

  loadDocuments: async () => {
    set({ isLoading: true });
    try {
      const results = await api.search('*', 50, 'hybrid');
      set((state) => ({
        documents: results,
        selectedDocument: state.selectedDocument ?? results[0] ?? null,
        isLoading: false,
        draftTitle: state.selectedDocument ? state.draftTitle : buildDraftTitle(results[0] ?? null),
        draftContent: state.selectedDocument ? state.draftContent : buildDraftContent(results[0] ?? null),
      }));
    } catch {
      set({ documents: [], isLoading: false });
    }
  },

  selectDocument: (doc) => {
    set({
      selectedDocument: doc,
      draftTitle: buildDraftTitle(doc),
      draftContent: buildDraftContent(doc),
    });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setDraftState: (title, content) => set({ draftTitle: title, draftContent: content }),

  seedDraftFromDocument: (doc) => {
    set({
      draftTitle: buildDraftTitle(doc),
      draftContent: buildDraftContent(doc),
    });
  },

  saveDraftToKnowledgeBase: async () => {
    const { draftTitle, draftContent, selectedDocument } = get();
    const tags = ['workspace-draft'];
    if (selectedDocument?.title) tags.push('workspace-source');
    const savedId = await api.addNote(draftTitle, draftContent, tags);
    await api.commit();
    set({ lastSavedAt: new Date().toISOString() });
    return savedId;
  },
}));

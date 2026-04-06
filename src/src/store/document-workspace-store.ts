import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/api';
import type { SearchHit } from '@/api';
import { STORAGE_KEYS } from '@/store/persistence';

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

export const useDocumentWorkspaceStore = create<DocumentWorkspaceState>()(
  persist(
    (set, get) => ({
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
            draftTitle: state.draftTitle && state.draftTitle !== 'Untitled Workspace Draft'
              ? state.draftTitle
              : buildDraftTitle(results[0] ?? null),
            draftContent: state.draftContent
              ? state.draftContent
              : buildDraftContent(results[0] ?? null),
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
    }),
    {
      name: STORAGE_KEYS.documentWorkspace.store,
      partialize: (state) => ({
        activeTab: state.activeTab,
        draftTitle: state.draftTitle,
        draftContent: state.draftContent,
        lastSavedAt: state.lastSavedAt,
      }),
    },
  ),
);

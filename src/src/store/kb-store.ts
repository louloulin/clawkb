import { create } from 'zustand';
import { api } from '@/api';
import type { KbStats, Page, SearchHit } from '@/api';
import { STORAGE_KEYS, safeStorageGetString, safeStorageSetString } from '@/store/persistence';

interface KbState {
  // KB state
  stats: KbStats | null;
  kbPath: string;
  isKbOpen: boolean;
  isLoading: boolean;
  error: string | null;

  // Navigation
  currentPage: Page;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;

  // Document detail panel
  selectedDocument: SearchHit | null;
  detailLoading: boolean;

  // Theme
  darkMode: boolean;

  // Actions
  openKb: (path: string) => Promise<void>;
  createKb: (path: string) => Promise<void>;
  refreshStats: () => Promise<void>;
  setPage: (page: Page) => void;
  toggleSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleDarkMode: () => void;
  setError: (error: string | null) => void;
  openDocument: (doc: SearchHit) => void;
  openDocumentByTitle: (title: string) => Promise<void>;
  closeDocument: () => void;
}

export const useKbStore = create<KbState>((set, get) => ({
  // Initial state
  stats: null,
  kbPath: '',
  isKbOpen: false,
  isLoading: false,
  error: null,
  currentPage: 'home',
  sidebarCollapsed: true,
  mobileSidebarOpen: false,
  selectedDocument: null,
  detailLoading: false,
  darkMode: (() => {
    try {
      const stored = safeStorageGetString(STORAGE_KEYS.kb.darkMode, '');
      if (stored !== '' && stored !== null) return stored === 'true';
      // Follow system preference
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  })(),

  // Actions
  openKb: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      const s = await api.openKb(path);
      safeStorageSetString(STORAGE_KEYS.kb.lastPath, path);
      set({ stats: s, kbPath: path, isKbOpen: true, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },

  createKb: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      const s = await api.createKb(path);
      safeStorageSetString(STORAGE_KEYS.kb.lastPath, path);
      set({ stats: s, kbPath: path, isKbOpen: true, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },

  refreshStats: async () => {
    if (!get().isKbOpen) return;
    try {
      const s = await api.getStats();
      set({ stats: s });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  setPage: (page: Page) => set({ currentPage: page }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMobileSidebarOpen: (open: boolean) => set({ mobileSidebarOpen: open }),
  toggleDarkMode: () => {
    const newDark = !get().darkMode;
    set({ darkMode: newDark });
    document.documentElement.classList.toggle('dark', newDark);
    safeStorageSetString(STORAGE_KEYS.kb.darkMode, String(newDark));
  },
  setError: (error: string | null) => set({ error }),

  openDocument: (doc: SearchHit) => {
    set({ selectedDocument: doc });
  },

  openDocumentByTitle: async (title: string) => {
    set({ detailLoading: true });
    try {
      const hits = await api.search(title, 5, 'lex');
      const match = hits.find(h => h.title === title) || hits[0];
      if (match) {
        set({ selectedDocument: match, detailLoading: false });
      } else {
        set({
          selectedDocument: {
            id: '',
            title,
            content: 'Document content not available',
            score: 0,
            tags: [],
            created_at: '',
            source: null,
          },
          detailLoading: false,
        });
      }
    } catch {
      set({ detailLoading: false });
    }
  },

  closeDocument: () => set({ selectedDocument: null }),
}));

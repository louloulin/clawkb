import { create } from 'zustand';
import { api } from '@/api';
import type { KbStats, Page, SearchHit } from '@/api';

const LAST_KB_PATH_KEY = 'clawkb-last-kb-path';

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
  selectedDocument: null,
  detailLoading: false,
  darkMode: (() => {
    try {
      const stored = localStorage.getItem('clawkb-dark');
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  })(),

  // Actions
  openKb: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      const s = await api.openKb(path);
      try { localStorage.setItem(LAST_KB_PATH_KEY, path); } catch {}
      set({ stats: s, kbPath: path, isKbOpen: true, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  createKb: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      const s = await api.createKb(path);
      try { localStorage.setItem(LAST_KB_PATH_KEY, path); } catch {}
      set({ stats: s, kbPath: path, isKbOpen: true, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  refreshStats: async () => {
    if (!get().isKbOpen) return;
    try {
      const s = await api.getStats();
      set({ stats: s });
    } catch {}
  },

  setPage: (page: Page) => set({ currentPage: page }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleDarkMode: () => {
    const newDark = !get().darkMode;
    set({ darkMode: newDark });
    document.documentElement.classList.toggle('dark', newDark);
    try { localStorage.setItem('clawkb-dark', String(newDark)); } catch {}
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

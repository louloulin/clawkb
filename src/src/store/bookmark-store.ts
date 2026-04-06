import { create } from 'zustand';
import { STORAGE_KEYS, safeStorageGet, safeStorageSet } from '@/store/persistence';
export interface Bookmark {
  id: string;
  docId: string;
  docUri: string | null;
  title: string;
  scrollTop: number;
  pageNumber?: number;
  note: string;
  color: string;
  createdAt: string;
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange';

const BOOKMARKS_KEY = STORAGE_KEYS.bookmarks.items;
const PROGRESS_KEY = STORAGE_KEYS.bookmarks.progress;

interface BookmarkState {
  bookmarks: Bookmark[];

  // Actions
  loadBookmarks: () => void;
  addBookmark: (docId: string, docUri: string | null, title: string, scrollTop: number, pageNumber?: number, note?: string, color?: HighlightColor) => void;
  removeBookmark: (id: string) => void;
  updateBookmarkNote: (id: string, note: string) => void;
  getBookmarksForDoc: (docId: string) => Bookmark[];
}

interface ReadingProgress {
  [docId: string]: {
    scrollTop: number;
    pageNumber?: number;
    lastReadAt: string;
  };
}

interface ProgressState {
  progress: ReadingProgress;

  loadProgress: () => void;
  saveProgress: (docId: string, scrollTop: number, pageNumber?: number) => void;
  getProgress: (docId: string) => { scrollTop: number; pageNumber?: number } | null;
}

// ── Bookmark Store ──────────────────────────────────────────────────────────────

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarks: [],

  loadBookmarks: () => {
    set({ bookmarks: safeStorageGet<Bookmark[]>(BOOKMARKS_KEY, []) });
  },

  addBookmark: (docId, docUri, title, scrollTop, pageNumber, note = '', color = 'yellow') => {
    const bookmark: Bookmark = {
      id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      docId,
      docUri,
      title,
      scrollTop,
      pageNumber,
      note,
      color,
      createdAt: new Date().toISOString(),
    };
    const updated = [...get().bookmarks, bookmark];
    set({ bookmarks: updated });
    safeStorageSet(BOOKMARKS_KEY, updated);
  },

  removeBookmark: (id: string) => {
    const updated = get().bookmarks.filter(b => b.id !== id);
    set({ bookmarks: updated });
    safeStorageSet(BOOKMARKS_KEY, updated);
  },

  updateBookmarkNote: (id: string, note: string) => {
    const updated = get().bookmarks.map(b =>
      b.id === id ? { ...b, note } : b
    );
    set({ bookmarks: updated });
    safeStorageSet(BOOKMARKS_KEY, updated);
  },

  getBookmarksForDoc: (docId: string) => {
    return get().bookmarks.filter(b => b.docId === docId);
  },
}));

// ── Reading Progress Store ────────────────────────────────────────────────────

export const useReadingProgressStore = create<ProgressState>((set, get) => ({
  progress: {},

  loadProgress: () => {
    set({ progress: safeStorageGet<ReadingProgress>(PROGRESS_KEY, {}) });
  },

  saveProgress: (docId: string, scrollTop: number, pageNumber?: number) => {
    const updated = {
      ...get().progress,
      [docId]: { scrollTop, pageNumber, lastReadAt: new Date().toISOString() },
    };
    set({ progress: updated });
    safeStorageSet(PROGRESS_KEY, updated);
  },

  getProgress: (docId: string) => {
    const p = get().progress[docId];
    if (!p) return null;
    return { scrollTop: p.scrollTop, pageNumber: p.pageNumber };
  },
}));

// ── Highlight Colors ────────────────────────────────────────────────────────────

export const HIGHLIGHT_COLORS: Record<HighlightColor, { light: string; dark: string; label: string }> = {
  yellow: { light: 'bg-yellow-50 border-yellow-200', dark: 'dark:bg-yellow-900/20 dark:border-yellow-800', label: 'Yellow' },
  green: { light: 'bg-green-50 border-green-200', dark: 'dark:bg-green-900/20 dark:border-green-800', label: 'Green' },
  blue: { light: 'bg-blue-50 border-blue-200', dark: 'dark:bg-blue-900/20 dark:border-blue-800', label: 'Blue' },
  pink: { light: 'bg-pink-50 border-pink-200', dark: 'dark:bg-pink-900/20 dark:border-pink-800', label: 'Pink' },
  orange: { light: 'bg-orange-50 border-orange-200', dark: 'dark:bg-orange-900/20 dark:border-orange-800', label: 'Orange' },
};

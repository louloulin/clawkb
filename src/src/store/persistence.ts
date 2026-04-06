export const STORAGE_KEYS = {
  kb: {
    lastPath: 'clawkb-last-kb-path',
    darkMode: 'clawkb-dark',
  },
  workspace: {
    store: 'clawkb-workspace',
  },
  chat: {
    history: 'clawkb-chat-history',
  },
  documentWorkspace: {
    store: 'clawkb-document-workspace',
  },
  bookmarks: {
    items: 'clawkb-bookmarks',
    progress: 'clawkb-reading-progress',
    highlights: 'clawkb-highlights',
  },
  ai: {
    config: 'clawkb-ai-config',
  },
  sync: {
    store: 'clawkb-sync',
  },
  multiKb: {
    store: 'clawkb-multi-kb',
  },
  demo: {
    folders: 'clawkb-browser-folders',
  },
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS][keyof (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]];

export function safeStorageGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function safeStorageGetString(key: string, fallback = ''): string {
  try {
    const raw = localStorage.getItem(key);
    return raw ?? fallback;
  } catch {
    return fallback;
  }
}

export function safeStorageSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
}

export function safeStorageSetString(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
}

export function safeStorageRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage failures
  }
}

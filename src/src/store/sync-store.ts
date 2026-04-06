import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VaultSummary, WebdavConfig, SyncStatus } from '@/api/types';
import { STORAGE_KEYS } from '@/store/persistence';

interface ObsidianConfig {
  vaultPath: string;
  lastScanned: VaultSummary | null;
  autoSync: boolean;
  syncTags: string[];
}

interface WebdavConfigState {
  url: string;
  username: string;
  password: string;
  remotePath: string;
  enabled: boolean;
  lastSync: number | null;
  lastError: string | null;
}

interface SyncState {
  // Obsidian config
  obsidianConfig: ObsidianConfig;
  setObsidianPath: (path: string) => void;
  setLastScanned: (summary: VaultSummary | null) => void;
  setAutoSync: (enabled: boolean) => void;
  setSyncTags: (tags: string[]) => void;
  resetObsidian: () => void;

  // WebDAV config
  webdavConfig: WebdavConfigState;
  setWebdavUrl: (url: string) => void;
  setWebdavUsername: (username: string) => void;
  setWebdavPassword: (password: string) => void;
  setWebdavRemotePath: (remotePath: string) => void;
  setWebdavEnabled: (enabled: boolean) => void;
  setWebdavSyncStatus: (status: SyncStatus | null) => void;
  resetWebdav: () => void;
  getWebdavConfig: () => WebdavConfig;
}

const defaultConfig: ObsidianConfig = {
  vaultPath: '',
  lastScanned: null,
  autoSync: false,
  syncTags: ['obsidian', 'imported'],
};

const defaultWebdav: WebdavConfigState = {
  url: '',
  username: '',
  password: '',
  remotePath: '/ClawKB',
  enabled: false,
  lastSync: null,
  lastError: null,
};

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      obsidianConfig: defaultConfig,

      setObsidianPath: (path) =>
        set((state) => ({
          obsidianConfig: { ...state.obsidianConfig, vaultPath: path },
        })),

      setLastScanned: (summary) =>
        set((state) => ({
          obsidianConfig: { ...state.obsidianConfig, lastScanned: summary },
        })),

      setAutoSync: (enabled) =>
        set((state) => ({
          obsidianConfig: { ...state.obsidianConfig, autoSync: enabled },
        })),

      setSyncTags: (tags) =>
        set((state) => ({
          obsidianConfig: { ...state.obsidianConfig, syncTags: tags },
        })),

      resetObsidian: () =>
        set({ obsidianConfig: defaultConfig }),

      // WebDAV
      webdavConfig: defaultWebdav,

      setWebdavUrl: (url) =>
        set((state) => ({ webdavConfig: { ...state.webdavConfig, url } })),
      setWebdavUsername: (username) =>
        set((state) => ({ webdavConfig: { ...state.webdavConfig, username } })),
      setWebdavPassword: (password) =>
        set((state) => ({ webdavConfig: { ...state.webdavConfig, password } })),
      setWebdavRemotePath: (remotePath) =>
        set((state) => ({ webdavConfig: { ...state.webdavConfig, remotePath } })),
      setWebdavEnabled: (enabled) =>
        set((state) => ({ webdavConfig: { ...state.webdavConfig, enabled } })),
      setWebdavSyncStatus: (status) =>
        set((state) => ({
          webdavConfig: {
            ...state.webdavConfig,
            lastSync: status?.last_sync ?? state.webdavConfig.lastSync,
            lastError: status?.last_error ?? state.webdavConfig.lastError,
          },
        })),
      resetWebdav: () =>
        set({ webdavConfig: defaultWebdav }),
      getWebdavConfig: () => {
        const { url, username, password, remotePath, enabled } = get().webdavConfig;
        return { url, username, password, remote_path: remotePath, enabled };
      },
    }),
    {
      name: STORAGE_KEYS.sync.store,
    }
  )
);

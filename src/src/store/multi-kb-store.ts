import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { KbStats } from '@/api';

export interface KbRegistration {
  id: string;
  name: string;
  path: string;
  description: string;
  collection: 'created' | 'joined' | 'shared';
  addedAt: number;
  lastOpenedAt: number | null;
  stats: Pick<KbStats, 'frame_count' | 'size_bytes'> | null;
}

interface MultiKbState {
  // Registered knowledge bases
  registeredKbs: KbRegistration[];
  // Active KB for @-query (null = current default KB)
  activeKbId: string | null;
  // Whether multi-KB mode is enabled
  multiKbEnabled: boolean;

  // Actions
  registerKb: (path: string, name: string, description?: string, collection?: KbRegistration['collection']) => KbRegistration | undefined;
  unregisterKb: (id: string) => void;
  renameKb: (id: string, name: string) => void;
  updateKb: (id: string, updates: Partial<Pick<KbRegistration, 'description' | 'collection'>>) => void;
  recordStats: (id: string, stats: KbStats) => void;
  markOpened: (id: string) => void;
  setActiveKb: (id: string | null) => void;
  setMultiKbEnabled: (enabled: boolean) => void;
  getKb: (id: string) => KbRegistration | undefined;
  getKbsByCollection: (collection: KbRegistration['collection']) => KbRegistration[];
}

export const useMultiKbStore = create<MultiKbState>()(
  persist(
    (set, get) => ({
      registeredKbs: [],
      activeKbId: null,
      multiKbEnabled: false,

      registerKb: (path, name, description = '', collection = 'created') => {
        const existing = get().registeredKbs.find(k => k.path === path);
        if (existing) return existing;

        const kb: KbRegistration = {
          id: `kb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name,
          path,
          description,
          collection,
          addedAt: Date.now() / 1000,
          lastOpenedAt: null,
          stats: null,
        };
        set(state => ({ registeredKbs: [...state.registeredKbs, kb] }));
        return kb;
      },

      unregisterKb: (id) => {
        set(state => ({
          registeredKbs: state.registeredKbs.filter(k => k.id !== id),
          activeKbId: state.activeKbId === id ? null : state.activeKbId,
        }));
      },

      renameKb: (id, name) => {
        set(state => ({
          registeredKbs: state.registeredKbs.map(k =>
            k.id === id ? { ...k, name } : k
          ),
        }));
      },

      updateKb: (id, updates) => {
        set(state => ({
          registeredKbs: state.registeredKbs.map(k =>
            k.id === id ? { ...k, ...updates } : k
          ),
        }));
      },

      recordStats: (id, stats) => {
        set(state => ({
          registeredKbs: state.registeredKbs.map(k =>
            k.id === id
              ? {
                  ...k,
                  stats: {
                    frame_count: stats.frame_count,
                    size_bytes: stats.size_bytes,
                  },
                }
              : k
          ),
        }));
      },

      markOpened: (id) => {
        set(state => ({
          registeredKbs: state.registeredKbs.map(k =>
            k.id === id ? { ...k, lastOpenedAt: Date.now() / 1000 } : k
          ),
        }));
      },

      setActiveKb: (id) => {
        set({ activeKbId: id });
      },

      setMultiKbEnabled: (enabled) => {
        set({ multiKbEnabled: enabled });
      },

      getKb: (id) => {
        return get().registeredKbs.find(k => k.id === id);
      },

      getKbsByCollection: (collection) => {
        return get().registeredKbs.filter(k => k.collection === collection);
      },
    }),
    {
      name: 'clawkb-multi-kb',
    }
  )
);

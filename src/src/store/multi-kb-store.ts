import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface KbRegistration {
  id: string;
  name: string;
  path: string;
  description: string;
  addedAt: number;
}

interface MultiKbState {
  // Registered knowledge bases
  registeredKbs: KbRegistration[];
  // Active KB for @-query (null = current default KB)
  activeKbId: string | null;
  // Whether multi-KB mode is enabled
  multiKbEnabled: boolean;

  // Actions
  registerKb: (path: string, name: string, description?: string) => void;
  unregisterKb: (id: string) => void;
  renameKb: (id: string, name: string) => void;
  setActiveKb: (id: string | null) => void;
  setMultiKbEnabled: (enabled: boolean) => void;
  getKb: (id: string) => KbRegistration | undefined;
}

export const useMultiKbStore = create<MultiKbState>()(
  persist(
    (set, get) => ({
      registeredKbs: [],
      activeKbId: null,
      multiKbEnabled: false,

      registerKb: (path, name, description = '') => {
        const existing = get().registeredKbs.find(k => k.path === path);
        if (existing) return;

        const kb: KbRegistration = {
          id: `kb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name,
          path,
          description,
          addedAt: Date.now() / 1000,
        };
        set(state => ({ registeredKbs: [...state.registeredKbs, kb] }));
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

      setActiveKb: (id) => {
        set({ activeKbId: id });
      },

      setMultiKbEnabled: (enabled) => {
        set({ multiKbEnabled: enabled });
      },

      getKb: (id) => {
        return get().registeredKbs.find(k => k.id === id);
      },
    }),
    {
      name: 'clawkb-multi-kb',
    }
  )
);

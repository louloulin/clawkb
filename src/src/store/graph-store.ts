import { create } from 'zustand';
import { api } from '@/api';
import type { EntityInfo, RelationEdge, MeshStats, MemoryCardInfo } from '@/api';

interface GraphState {
  entities: EntityInfo[];
  edges: RelationEdge[];
  stats: MeshStats | null;
  memories: MemoryCardInfo[];
  selectedEntity: EntityInfo | null;
  selectedEdges: RelationEdge[];
  isLoading: boolean;
  error: string | null;
  kindFilter: string | null;

  // Actions
  loadGraph: () => Promise<void>;
  selectEntity: (entity: EntityInfo | null) => Promise<void>;
  setKindFilter: (kind: string | null) => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  entities: [],
  edges: [],
  stats: null,
  memories: [],
  selectedEntity: null,
  selectedEdges: [],
  isLoading: false,
  error: null,
  kindFilter: null,

  loadGraph: async () => {
    set({ isLoading: true, error: null });
    try {
      const [entities, stats, memories] = await Promise.all([
        api.listEntities(get().kindFilter || undefined),
        api.getMeshStats(),
        api.listMemories(),
      ]);
      set({ entities, stats, memories, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: String(e) });
    }
  },

  selectEntity: async (entity: EntityInfo | null) => {
    if (!entity) {
      set({ selectedEntity: null, selectedEdges: [] });
      return;
    }
    set({ selectedEntity: entity });
    try {
      const edges = await api.getEntityEdges(entity.id);
      set({ selectedEdges: edges });
    } catch {
      set({ selectedEdges: [] });
    }
  },

  setKindFilter: (kind: string | null) => {
    set({ kindFilter: kind });
    get().loadGraph();
  },
}));

import { create } from 'zustand';

export type ExploreView =
  | 'search'
  | 'import'
  | 'notes'
  | 'timeline'
  | 'tags'
  | 'graph'
  | 'mindmap'
  | 'report'
  | 'podcast';

export type SpaceCollection = 'personal' | 'created' | 'joined' | 'shared';
export type DocumentsView = 'reader' | 'draft';

interface WorkspaceState {
  activeExploreView: ExploreView;
  activeSpaceCollection: SpaceCollection;
  activeDocumentsView: DocumentsView;
  selectedSpaceId: string | null;
  setActiveExploreView: (view: ExploreView) => void;
  openExploreView: (view: ExploreView) => void;
  setActiveSpaceCollection: (collection: SpaceCollection) => void;
  setActiveDocumentsView: (view: DocumentsView) => void;
  setSelectedSpaceId: (id: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeExploreView: 'search',
  activeSpaceCollection: 'personal',
  activeDocumentsView: 'reader',
  selectedSpaceId: null,
  setActiveExploreView: (view) => set({ activeExploreView: view }),
  openExploreView: (view) => set({ activeExploreView: view }),
  setActiveSpaceCollection: (collection) => set({ activeSpaceCollection: collection }),
  setActiveDocumentsView: (view) => set({ activeDocumentsView: view }),
  setSelectedSpaceId: (id) => set({ selectedSpaceId: id }),
}));

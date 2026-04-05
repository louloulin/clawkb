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
export type ImportView = 'file' | 'url' | 'media' | 'screenshot';

interface WorkspaceState {
  activeExploreView: ExploreView;
  activeSpaceCollection: SpaceCollection;
  activeDocumentsView: DocumentsView;
  preferredImportView: ImportView;
  selectedSpaceId: string | null;
  setActiveExploreView: (view: ExploreView) => void;
  openExploreView: (view: ExploreView) => void;
  openImportView: (view: ImportView) => void;
  setActiveSpaceCollection: (collection: SpaceCollection) => void;
  setActiveDocumentsView: (view: DocumentsView) => void;
  setPreferredImportView: (view: ImportView) => void;
  setSelectedSpaceId: (id: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeExploreView: 'search',
  activeSpaceCollection: 'personal',
  activeDocumentsView: 'reader',
  preferredImportView: 'file',
  selectedSpaceId: null,
  setActiveExploreView: (view) => set({ activeExploreView: view }),
  openExploreView: (view) => set({ activeExploreView: view }),
  openImportView: (view) => set({ activeExploreView: 'import', preferredImportView: view }),
  setActiveSpaceCollection: (collection) => set({ activeSpaceCollection: collection }),
  setActiveDocumentsView: (view) => set({ activeDocumentsView: view }),
  setPreferredImportView: (view) => set({ preferredImportView: view }),
  setSelectedSpaceId: (id) => set({ selectedSpaceId: id }),
}));

import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '@/store/persistence';
import { useDocumentWorkspaceStore } from '@/store/document-workspace-store';
import { useWorkspaceStore } from '@/store/workspace-store';

describe('store persistence', () => {
  beforeEach(() => {
    localStorage.clear();

    useWorkspaceStore.setState({
      activeExploreView: 'search',
      activeSpaceCollection: 'personal',
      activeDocumentsView: 'reader',
      preferredImportView: 'file',
      selectedSpaceId: null,
    });

    useDocumentWorkspaceStore.setState({
      documents: [],
      selectedDocument: null,
      activeTab: 'reader',
      isLoading: false,
      draftTitle: 'Untitled Workspace Draft',
      draftContent: '',
      lastSavedAt: null,
    });
  });

  it('persists workspace navigation choices into localStorage', () => {
    useWorkspaceStore.getState().openImportView('media');
    useWorkspaceStore.getState().setActiveDocumentsView('draft');
    useWorkspaceStore.getState().setSelectedSpaceId('space-42');

    const snapshot = JSON.parse(localStorage.getItem(STORAGE_KEYS.workspace.store) ?? '{}');

    expect(snapshot.state).toMatchObject({
      activeExploreView: 'import',
      activeDocumentsView: 'draft',
      preferredImportView: 'media',
      selectedSpaceId: 'space-42',
    });
  });

  it('persists document draft state for reload recovery', () => {
    useDocumentWorkspaceStore.getState().setActiveTab('draft');
    useDocumentWorkspaceStore.getState().setDraftState('Persistent Draft', 'Recovered body');

    const snapshot = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.documentWorkspace.store) ?? '{}',
    );

    expect(snapshot.state).toMatchObject({
      activeTab: 'draft',
      draftTitle: 'Persistent Draft',
      draftContent: 'Recovered body',
    });
  });
});

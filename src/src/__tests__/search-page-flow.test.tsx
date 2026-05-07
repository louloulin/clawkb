import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const searchHookMock = vi.hoisted(() => ({
  results: [
    {
      id: 'doc-1',
      title: '行业周报.pdf',
      content: '这是一个可进入阅读与笔记链路的资料。',
      score: 1,
      tags: ['weekly'],
      created_at: '2026-04-11T00:00:00Z',
      source: '/Users/demo/weekly.pdf',
    },
  ],
  loading: false,
  search: vi.fn(),
}));

vi.mock('@/hooks', () => ({
  useSearch: () => searchHookMock,
  useTags: () => ({ tags: [] }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { SearchPage } from '@/components/pages/search';
import { useDocumentWorkspaceStore } from '@/store/document-workspace-store';
import { useKbStore } from '@/store/kb-store';
import { useWorkspaceStore } from '@/store/workspace-store';

describe('search page source-to-note flow', () => {
  beforeEach(() => {
    localStorage.clear();

    useKbStore.setState({
      stats: {
        frame_count: 12,
        size_bytes: 1024,
        has_lex_index: true,
        has_vec_index: false,
        payload_bytes: 2048,
        compression_ratio_percent: 50,
        path: '/Users/demo/knowledge.mv2',
      },
      kbPath: '/Users/demo/knowledge.mv2',
      isKbOpen: true,
      isLoading: false,
      error: null,
      currentPage: 'documents',
      sidebarCollapsed: false,
      selectedDocument: null,
      detailLoading: false,
      darkMode: true,
    });

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

  it('routes an opened result into the note-oriented reader flow', async () => {
    render(<SearchPage />);

    fireEvent.click(screen.getByText('行业周报.pdf'));

    await waitFor(() => {
      expect(useKbStore.getState().currentPage).toBe('reader');
    });
    expect(useWorkspaceStore.getState().activeDocumentsView).toBe('reader');
    expect(useDocumentWorkspaceStore.getState().activeTab).toBe('reader');
    expect(useDocumentWorkspaceStore.getState().selectedDocument?.title).toBe('行业周报.pdf');
    expect(useDocumentWorkspaceStore.getState().draftTitle).toBe('行业周报.pdf · Draft');
  });
});

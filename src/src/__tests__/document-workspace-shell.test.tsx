import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/components/pages/reader', () => ({
  ReaderPage: () => <div data-testid="reader-page">Reader page</div>,
}));

vi.mock('@/components/pages/editor', () => ({
  EditorPage: ({ initialTitle }: { initialTitle: string }) => (
    <div data-testid="editor-page">Editor title: {initialTitle}</div>
  ),
}));

vi.mock('@/components/pages/notes', () => ({
  NotesPage: () => <div data-testid="notes-page">Notes page</div>,
}));

vi.mock('@/components/pages/report', () => ({
  ReportPage: () => <div data-testid="report-page">Report page</div>,
}));

vi.mock('@/components/pages/podcast', () => ({
  PodcastPage: () => <div data-testid="podcast-page">Podcast page</div>,
}));

const apiMock = vi.hoisted(() => ({
  search: vi.fn(),
  addNote: vi.fn(),
  commit: vi.fn(),
}));

vi.mock('@/api', () => ({
  api: {
    search: apiMock.search,
    addNote: apiMock.addNote,
    commit: apiMock.commit,
  },
}));

import { DocumentWorkspaceShell } from '@/components/shell/document-workspace-shell';
import { useDocumentWorkspaceStore } from '@/store/document-workspace-store';
import { useKbStore } from '@/store/kb-store';
import { useWorkspaceStore } from '@/store/workspace-store';
import type { SearchHit } from '@/api';

const sampleDoc: SearchHit = {
  id: 'doc-1',
  title: 'Weekly Notes',
  content: 'Document workspace smoke test content',
  score: 1,
  tags: ['weekly'],
  created_at: '2026-04-06T00:00:00Z',
  source: '/notes/weekly.md',
};

describe('document workspace smoke', () => {
  beforeEach(() => {
    localStorage.clear();
    apiMock.search.mockReset();
    apiMock.addNote.mockReset();
    apiMock.commit.mockReset();
    apiMock.search.mockResolvedValue([sampleDoc]);

    useKbStore.setState({
      stats: {
        frame_count: 1,
        size_bytes: 1024,
        has_lex_index: true,
        has_vec_index: false,
        payload_bytes: 2048,
        compression_ratio_percent: 50,
        path: '/kb/personal.mv2',
      },
      kbPath: '/kb/personal.mv2',
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
      activeDocumentsView: 'draft',
      preferredImportView: 'file',
      selectedSpaceId: null,
    });

    useDocumentWorkspaceStore.setState({
      documents: [],
      selectedDocument: null,
      activeTab: 'reader',
      isLoading: false,
      draftTitle: 'Persistent Draft',
      draftContent: 'Persisted content',
      lastSavedAt: null,
    });
  });

  it('opens the draft workspace and renders the editor payload for the current document flow', async () => {
    render(<DocumentWorkspaceShell />);

    await waitFor(() =>
      expect(screen.getByTestId('editor-page')).toHaveTextContent('Editor title: Persistent Draft'),
    );
    expect(screen.getByText('笔记工作区')).toBeInTheDocument();
    expect(screen.getByText('当前资料')).toBeInTheDocument();
    expect(screen.queryByText('Document Flow')).not.toBeInTheDocument();
  });

  it('shows KB setup guidance when the document workspace has no real local KB open', () => {
    useKbStore.setState({
      stats: null,
      kbPath: '',
      isKbOpen: false,
      isLoading: false,
      error: null,
      currentPage: 'documents',
      sidebarCollapsed: false,
      selectedDocument: null,
      detailLoading: false,
      darkMode: true,
    });

    render(<DocumentWorkspaceShell />);

    expect(screen.getByText('先打开一个本地知识库，再进入笔记工作区')).toBeInTheDocument();
    expect(screen.queryByText('No local KB mounted')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '打开或创建知识库' }));

    expect(useKbStore.getState().currentPage).toBe('settings');
  });
});

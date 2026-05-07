import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const dialogMock = vi.hoisted(() => ({
  open: vi.fn(),
}));

const apiMock = vi.hoisted(() => ({
  importFile: vi.fn(),
  importDirectory: vi.fn(),
  importAudio: vi.fn(),
  importImage: vi.fn(),
  fetchUrl: vi.fn(),
  importScreenshot: vi.fn(),
  commit: vi.fn(),
}));

const toastMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/plugin-dialog', () => dialogMock);
vi.mock('@/api', () => ({
  api: apiMock,
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

import { ImportPage } from '@/components/pages/import';
import { useKbStore } from '@/store/kb-store';
import { useWorkspaceStore } from '@/store/workspace-store';

describe('import page native picker flow', () => {
  beforeEach(() => {
    localStorage.clear();
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};

    dialogMock.open.mockReset();
    toastMock.mockReset();
    apiMock.importFile.mockReset();
    apiMock.importDirectory.mockReset();
    apiMock.importAudio.mockReset();
    apiMock.importImage.mockReset();
    apiMock.fetchUrl.mockReset();
    apiMock.importScreenshot.mockReset();
    apiMock.commit.mockReset();

    apiMock.importDirectory.mockResolvedValue([{ success: true, title: 'folder', chunks: 1, tags: [], auto_tags: [] }]);
    apiMock.commit.mockResolvedValue(undefined);

    useWorkspaceStore.setState({
      activeExploreView: 'import',
      activeSpaceCollection: 'personal',
      activeDocumentsView: 'reader',
      preferredImportView: 'file',
      selectedSpaceId: null,
    });

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
      currentPage: 'explore',
      sidebarCollapsed: false,
      selectedDocument: null,
      detailLoading: false,
      darkMode: true,
    });
  });

  it('uses the directory picker and imports without requiring a trailing slash hack', async () => {
    dialogMock.open.mockResolvedValueOnce('/Users/demo/Documents');

    render(<ImportPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Choose Folder' }));
    expect(await screen.findByDisplayValue('/Users/demo/Documents')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Import$/ }));

    await waitFor(() =>
      expect(apiMock.importDirectory).toHaveBeenCalledWith('/Users/demo/Documents', [], false),
    );
    expect(apiMock.importFile).not.toHaveBeenCalled();
  });

  it('keeps media imports hidden until the user explicitly expands advanced imports', () => {
    render(<ImportPage />);

    expect(screen.queryByRole('tab', { name: 'Media' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Screenshot' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '显示高级导入方式' })).toBeInTheDocument();
  });

  it('guides the user back into source work right after a successful import', async () => {
    dialogMock.open.mockResolvedValueOnce('/Users/demo/reference.pdf');
    apiMock.importFile.mockResolvedValueOnce({
      success: true,
      title: 'reference.pdf',
      chunks: 8,
      tags: [],
      auto_tags: [],
    });

    render(<ImportPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Choose File' }));
    expect(await screen.findByDisplayValue('/Users/demo/reference.pdf')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Import$/ }));

    await screen.findByRole('button', { name: '在工作台继续提问' });
    fireEvent.click(screen.getByRole('button', { name: '打开资料工作面' }));

    expect(useKbStore.getState().currentPage).toBe('documents');
    expect(useWorkspaceStore.getState().activeExploreView).toBe('search');
  });
});

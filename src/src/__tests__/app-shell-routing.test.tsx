import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/layout', () => ({
  Sidebar: () => <div>Sidebar</div>,
  Header: () => <div>Header</div>,
  MobileBottomNav: () => <div>MobileBottomNav</div>,
}));

vi.mock('@/components/document-detail', () => ({
  DocumentDetailPanel: () => <div>DocumentDetailPanel</div>,
}));

vi.mock('@/components/selection-panel', () => ({
  SelectionPanel: () => <div>SelectionPanel</div>,
}));

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => <div>Toaster</div>,
}));

vi.mock('@/components/shell/document-workspace-shell', () => ({
  DocumentWorkspaceShell: () => <div>DocumentWorkspaceShell</div>,
}));

vi.mock('@/components/shell/explore-shell', () => ({
  ExploreShell: () => <div>ExploreShell</div>,
}));

vi.mock('@/components/shell/knowledge-space-shell', () => ({
  KnowledgeSpaceShell: () => <div>KnowledgeSpaceShell</div>,
}));

vi.mock('@/components/shell/workbench-shell', () => ({
  WorkbenchShell: () => <div>WorkbenchShell</div>,
}));

vi.mock('@/components/pages/settings', () => ({
  SettingsPage: () => <div>SettingsPage</div>,
}));

import App from '@/App';
import { useKbStore } from '@/store/kb-store';

describe('app shell page routing', () => {
  beforeEach(() => {
    localStorage.clear();
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
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
  });

  it('renders the source-oriented shell for documents', async () => {
    render(<App />);

    expect(await screen.findByText('ExploreShell')).toBeInTheDocument();
    expect(screen.queryByText('DocumentWorkspaceShell')).not.toBeInTheDocument();
  });

  it('renders the note-oriented shell for reader', async () => {
    useKbStore.setState({ currentPage: 'reader' });

    render(<App />);

    expect(await screen.findByText('DocumentWorkspaceShell')).toBeInTheDocument();
    expect(screen.queryByText('ExploreShell')).not.toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/components/folder-tree', () => ({
  FolderTree: () => <div data-testid="folder-tree">Folder tree</div>,
}));

import { Header, Sidebar } from '@/components/layout';
import { useKbStore } from '@/store/kb-store';

describe('workspace shell navigation smoke', () => {
  beforeEach(() => {
    localStorage.clear();
    useKbStore.setState({
      stats: null,
      kbPath: '',
      isKbOpen: false,
      isLoading: false,
      error: null,
      currentPage: 'home',
      sidebarCollapsed: false,
      selectedDocument: null,
      detailLoading: false,
      darkMode: true,
    });
  });

  it('switches from workbench to explore and updates the header label', () => {
    render(
      <>
        <Sidebar />
        <Header />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: /explore/i }));

    expect(useKbStore.getState().currentPage).toBe('explore');
    expect(screen.getByText('Explore Workspace')).toBeInTheDocument();
  });
});

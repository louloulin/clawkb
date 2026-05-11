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

  it('switches from workbench to documents and updates the header label', () => {
    render(
      <>
        <Sidebar />
        <Header />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: /^知识库$/i }));

    expect(useKbStore.getState().currentPage).toBe('spaces');
    expect(screen.getAllByText('知识库').length).toBeGreaterThan(0);
  });

  it('keeps the primary rail focused on workbench, sources, notes, and settings', () => {
    render(<Sidebar />);

    expect(screen.getByRole('button', { name: /^工作台$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^知识库$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^笔记$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^设置$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /个人知识库/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /explore/i })).not.toBeInTheDocument();
  });

  it('uses workbench wording instead of ask-first home wording', () => {
    render(<Sidebar />);

    expect(screen.getByRole('button', { name: /工作台/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /问答/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /首页/i })).not.toBeInTheDocument();
  });

  it('keeps the primary rail minimal by hiding the folder tree block', () => {
    render(<Sidebar />);

    expect(screen.queryByTestId('folder-tree')).not.toBeInTheDocument();
  });
});


describe('header source routing', () => {
  beforeEach(() => {
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

  it('routes the header search shortcut into the documents workspace', () => {
    render(<Header />);

    fireEvent.click(screen.getByRole('button', { name: /搜索你的知识库/i }));

    expect(useKbStore.getState().currentPage).toBe('documents');
  });
});

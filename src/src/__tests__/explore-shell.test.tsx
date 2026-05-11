import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/components/pages/search', () => ({
  SearchPage: () => <div>Search page</div>,
}));

vi.mock('@/components/pages/import', () => ({
  ImportPage: () => <div>Import page</div>,
}));

vi.mock('@/components/pages/notes', () => ({
  NotesPage: () => <div>Notes page</div>,
}));

vi.mock('@/components/pages/timeline', () => ({
  TimelinePage: () => <div>Timeline page</div>,
}));

vi.mock('@/components/pages/tags', () => ({
  TagsPage: () => <div>Tags page</div>,
}));

vi.mock('@/components/pages/entities', () => ({
  EntitiesPage: () => <div>Entities page</div>,
}));

vi.mock('@/components/pages/graph', () => ({
  GraphPage: () => <div>Graph page</div>,
}));

vi.mock('@/components/pages/mindmap', () => ({
  MindMapPage: () => <div>Mind map page</div>,
}));

vi.mock('@/components/pages/report', () => ({
  ReportPage: () => <div>Report page</div>,
}));

vi.mock('@/components/pages/podcast', () => ({
  PodcastPage: () => <div>Podcast page</div>,
}));

import { ExploreShell } from '@/components/shell/explore-shell';
import { useWorkspaceStore } from '@/store/workspace-store';

describe('source workspace shell', () => {
  beforeEach(() => {
    localStorage.clear();
    useWorkspaceStore.setState({
      activeExploreView: 'search',
      activeSpaceCollection: 'personal',
      activeDocumentsView: 'reader',
      preferredImportView: 'file',
      selectedSpaceId: null,
    });
  });

  it('frames the page as a source workspace with advanced tools collapsed by default', async () => {
    render(<ExploreShell />);

    await screen.findByText('Search page');

    expect(screen.getByText('资料工作面')).toBeInTheDocument();
    expect(screen.getByText('先搜索、导入和整理资料，再进入阅读与笔记沉淀。')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '搜索' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '导入' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Notes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Timeline' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '显示高级资料工具' })).toBeInTheDocument();
    expect(screen.queryByText(/Search、Import 和 Notes/i)).not.toBeInTheDocument();
  });

  it('reveals advanced tools only when explicitly expanded', async () => {
    render(<ExploreShell />);

    await screen.findByText('Search page');

    fireEvent.click(screen.getByRole('button', { name: '显示高级资料工具' }));

    expect(screen.getByRole('tab', { name: '时间线' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '报告' })).toBeInTheDocument();
  });
});

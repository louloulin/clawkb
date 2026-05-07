import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/api', () => ({
  api: {
    openExtraKb: vi.fn().mockResolvedValue({ frame_count: 12, size_bytes: 2048 }),
    aiAsk: vi.fn(),
    aiAskMulti: vi.fn(),
    search: vi.fn().mockResolvedValue([
      {
        id: 'doc-current',
        title: 'ima知识库使用指南.docx',
        content: '知识库导入、问答、阅读与笔记示例内容',
        score: 1,
        tags: ['guide'],
        created_at: '2026-04-11T00:00:00Z',
        source: '/Users/demo/current-guide.docx',
      },
    ]),
    searchMultiKb: vi.fn().mockResolvedValue([
      {
        id: 'doc-1',
        title: '投资研究周报.pdf',
        content: '本周行业研究与重点结论',
        score: 1,
        tags: ['weekly'],
        created_at: '2026-04-11T00:00:00Z',
        source: '/Users/demo/invest-weekly.pdf',
      },
    ]),
  },
}));

import { api } from '@/api';
import { KnowledgeSpaceShell } from '@/components/shell/knowledge-space-shell';
import { useDocumentWorkspaceStore } from '@/store/document-workspace-store';
import { useKbStore } from '@/store/kb-store';
import { useMultiKbStore } from '@/store/multi-kb-store';
import { useWorkspaceStore } from '@/store/workspace-store';

describe('knowledge space shell mvp surface', () => {
  beforeEach(() => {
    localStorage.clear();

    useKbStore.setState({
      stats: {
        frame_count: 32,
        size_bytes: 4096,
        has_lex_index: true,
        has_vec_index: false,
        payload_bytes: 8192,
        compression_ratio_percent: 50,
        path: '/Users/demo/current.mv2',
      },
      kbPath: '/Users/demo/current.mv2',
      isKbOpen: true,
      isLoading: false,
      error: null,
      currentPage: 'spaces',
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

    useMultiKbStore.setState({
      registeredKbs: [
        {
          id: 'kb-1',
          name: '投资研究',
          path: '/Users/demo/invest.mv2',
          description: '行业研究资料',
          collection: 'created',
          addedAt: 1,
          lastOpenedAt: null,
          stats: { frame_count: 12, size_bytes: 2048 },
        },
      ],
      activeKbId: null,
      multiKbEnabled: false,
    });

    vi.mocked(api.aiAsk).mockResolvedValue({
      answer: '这是基于资料的回答',
      citations: [],
      context: [
        {
          rank: 1,
          frame_id: 'doc-current',
          uri: '/Users/demo/current-guide.docx',
          title: 'ima知识库使用指南.docx',
          score: 0.9,
          text: '知识库导入、问答、阅读与笔记示例内容',
        },
      ],
      retriever: 'hybrid',
      context_only: false,
    });
  });

  it('frames the page as knowledge-base management instead of a parallel workbench', async () => {
    render(<KnowledgeSpaceShell />);

    await waitFor(() =>
      expect(screen.getAllByText('知识库管理').length).toBeGreaterThan(0),
    );
    expect(screen.getByText('选择当前要工作的知识库，并决定从资料还是笔记继续。')).toBeInTheDocument();
    expect(screen.queryByText('先选知识库，再直接进入资料和笔记。')).not.toBeInTheDocument();
    expect(screen.queryByText('Space Registry')).not.toBeInTheDocument();
    expect(screen.queryByText('Selected Space')).not.toBeInTheDocument();
  });

  it('uses action labels that route users back into sources and notes work', async () => {
    render(<KnowledgeSpaceShell />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /进入资料/i })).toBeInTheDocument(),
    );
    expect(screen.getAllByRole('button', { name: /进入笔记/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /打开问答/i })).not.toBeInTheDocument();
  });

  it('shows created libraries inside the personal knowledge-base lane', async () => {
    render(<KnowledgeSpaceShell />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /投资研究/i })).toBeInTheDocument(),
    );
    expect(screen.getAllByText('投资研究').length).toBeGreaterThan(0);
  });

  it('reveals knowledge-base settings only when explicitly requested', async () => {
    render(<KnowledgeSpaceShell />);

    fireEvent.click(screen.getByRole('button', { name: /投资研究/i }));
    await waitFor(() =>
      expect(screen.getAllByText('投资研究周报.pdf').length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getByRole('button', { name: '编辑知识库设置' }));

    await waitFor(() =>
      expect(screen.getByPlaceholderText('知识库名称')).toBeInTheDocument(),
    );
  });

  it('shows source cards in kb answers and opens the cited document in the notes workspace', async () => {
    render(<KnowledgeSpaceShell />);

    fireEvent.change(screen.getByPlaceholderText('基于 current.mv2 提问…'), {
      target: { value: '如何使用这个知识库？' },
    });
    fireEvent.click(screen.getByRole('button', { name: /发送提问/i }));

    await waitFor(() => expect(screen.getByText('来源')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: /ima知识库使用指南\.docx/i })[1]);

    await waitFor(() => expect(useKbStore.getState().currentPage).toBe('documents'));
    expect(useWorkspaceStore.getState().activeDocumentsView).toBe('reader');
    expect(useDocumentWorkspaceStore.getState().selectedDocument?.title).toBe('ima知识库使用指南.docx');
  });
});

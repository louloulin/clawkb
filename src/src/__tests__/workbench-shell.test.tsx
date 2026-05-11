import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const apiMock = vi.hoisted(() => ({
  search: vi.fn(),
  searchMultiKb: vi.fn(),
  timeline: vi.fn(),
}));

vi.mock('@/api', () => ({
  api: {
    search: apiMock.search,
    searchMultiKb: apiMock.searchMultiKb,
    timeline: apiMock.timeline,
  },
}));

import { WorkbenchShell } from '@/components/shell/workbench-shell';
import { useAiStore } from '@/store/ai-store';
import { useChatStore } from '@/store/chat-store';
import { useDocumentWorkspaceStore } from '@/store/document-workspace-store';
import { useKbStore } from '@/store/kb-store';
import { useMultiKbStore } from '@/store/multi-kb-store';
import { STORAGE_KEYS } from '@/store/persistence';
import { useWorkspaceStore } from '@/store/workspace-store';

describe('workbench shell onboarding state', () => {
  beforeEach(() => {
    localStorage.clear();
    apiMock.search.mockReset();
    apiMock.searchMultiKb.mockReset();
    apiMock.timeline.mockReset();
    apiMock.search.mockResolvedValue([
      {
        id: 'doc-source',
        title: 'ima知识库使用指南.docx',
        content: '完整文档内容',
        score: 1,
        tags: ['guide'],
        created_at: '2026-04-11T00:00:00Z',
        source: '/Users/demo/ima-guide.docx',
      },
    ]);
    apiMock.timeline.mockResolvedValue([
      {
        id: 'entry-1',
        title: '周会笔记',
        timestamp: '2026-04-15T10:00:00Z',
        snippet: '刚导入的会议整理',
      },
      {
        id: 'entry-2',
        title: '行业研究周报',
        timestamp: '2026-04-15T09:00:00Z',
        snippet: '最新导入的行业报告',
      },
    ]);

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

    useChatStore.setState({
      messages: [],
      isLoading: false,
      error: null,
      showSources: false,
      activeMessageId: null,
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

    useAiStore.setState({
      embedding: {
        provider: 'local',
        model: 'bge-small-en',
        apiKey: '',
        apiBase: 'https://api.openai.com/v1',
      },
      ask: {
        model: 'default',
        customModelName: '',
        temperature: 0.7,
        topK: 8,
        apiKey: '',
        apiBase: '',
      },
      isConfigured: false,
    });

    useMultiKbStore.setState({
      registeredKbs: [],
      activeKbId: null,
      multiKbEnabled: false,
    });

    useWorkspaceStore.setState({
      activeExploreView: 'search',
      activeSpaceCollection: 'personal',
      activeDocumentsView: 'reader',
      preferredImportView: 'file',
      selectedSpaceId: null,
    });
  });

  it('routes the user to KB setup instead of pretending chat is ready', () => {
    render(<WorkbenchShell />);

    expect(screen.getByText('先打开一个本地知识库，再开始提问和做笔记')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开或创建知识库' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开或创建知识库' })).toBeEnabled();
    expect(screen.queryByText('常用动作')).not.toBeInTheDocument();
    expect(screen.queryByText('最近问答')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '打开或创建知识库' }));

    expect(useKbStore.getState().currentPage).toBe('settings');
  });

  it('opens the cited source in the document workspace when a source card is clicked', async () => {
    useKbStore.setState({
      stats: {
        frame_count: 12,
        size_bytes: 2048,
        has_lex_index: true,
        has_vec_index: false,
        payload_bytes: 4096,
        compression_ratio_percent: 50,
        path: '/Users/demo/current.mv2',
      },
      kbPath: '/Users/demo/current.mv2',
      isKbOpen: true,
      isLoading: false,
      error: null,
      currentPage: 'home',
      sidebarCollapsed: false,
      selectedDocument: null,
      detailLoading: false,
      darkMode: true,
    });

    useChatStore.setState({
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: '这是回答',
          timestamp: '2026-04-11T00:00:00Z',
          historyKey: 'scope:/Users/demo/current.mv2',
          context: [
            {
              rank: 1,
              frame_id: 'doc-source',
              uri: '/Users/demo/ima-guide.docx',
              title: 'ima知识库使用指南.docx',
              score: 0.9,
              text: '来源片段',
            },
          ],
        },
      ],
      isLoading: false,
      error: null,
      showSources: true,
      activeMessageId: 'assistant-1',
    });
    localStorage.setItem(
      STORAGE_KEYS.chat.history,
      JSON.stringify(useChatStore.getState().messages),
    );

    render(<WorkbenchShell />);

    fireEvent.click(screen.getByRole('button', { name: /ima知识库使用指南\.docx/i }));

    await waitFor(() => expect(useKbStore.getState().currentPage).toBe('documents'));
    expect(useWorkspaceStore.getState().activeDocumentsView).toBe('reader');
    expect(useDocumentWorkspaceStore.getState().selectedDocument?.title).toBe('ima知识库使用指南.docx');
  });

  it('keeps chat history scoped to the current kb instead of leaking another kb conversation', async () => {
    useKbStore.setState({
      stats: {
        frame_count: 12,
        size_bytes: 2048,
        has_lex_index: true,
        has_vec_index: false,
        payload_bytes: 4096,
        compression_ratio_percent: 50,
        path: '/Users/demo/current.mv2',
      },
      kbPath: '/Users/demo/current.mv2',
      isKbOpen: true,
      isLoading: false,
      error: null,
      currentPage: 'home',
      sidebarCollapsed: false,
      selectedDocument: null,
      detailLoading: false,
      darkMode: true,
    });

    localStorage.setItem(
      STORAGE_KEYS.chat.history,
      JSON.stringify([
        {
          id: 'assistant-other',
          role: 'assistant',
          content: '另一个知识库的回答',
          timestamp: '2026-04-11T00:00:00Z',
          historyKey: 'scope:/Users/demo/other.mv2',
          context: [
            {
              rank: 1,
              frame_id: 'doc-other',
              uri: '/Users/demo/other.docx',
              title: '别的知识库资料.docx',
              score: 0.6,
              text: '别的知识库来源',
            },
          ],
        },
      ]),
    );

    render(<WorkbenchShell />);

    await waitFor(() =>
      expect(screen.getByPlaceholderText('基于当前知识库提问，或输入你要整理的笔记主题…')).toBeInTheDocument(),
    );
    expect(screen.queryByText('来源')).not.toBeInTheDocument();
    expect(screen.queryByText('别的知识库资料.docx')).not.toBeInTheDocument();
  });

  it('keeps the open-kb home focused on the ask panel instead of a large hero card', async () => {
    useKbStore.setState({
      stats: {
        frame_count: 12,
        size_bytes: 2048,
        has_lex_index: true,
        has_vec_index: false,
        payload_bytes: 4096,
        compression_ratio_percent: 50,
        path: '/Users/demo/current.mv2',
      },
      kbPath: '/Users/demo/current.mv2',
      isKbOpen: true,
      isLoading: false,
      error: null,
      currentPage: 'home',
      sidebarCollapsed: false,
      selectedDocument: null,
      detailLoading: false,
      darkMode: true,
    });

    render(<WorkbenchShell />);

    await waitFor(() =>
      expect(screen.getByPlaceholderText('基于当前知识库提问，或输入你要整理的笔记主题…')).toBeInTheDocument(),
    );
    expect(screen.queryByText('先问当前知识库，再继续笔记和写作。')).not.toBeInTheDocument();
  });

  it('shows a compact current-kb and recent-activity strip when a kb is already open', async () => {
    useKbStore.setState({
      stats: {
        frame_count: 12,
        size_bytes: 2048,
        has_lex_index: true,
        has_vec_index: false,
        payload_bytes: 4096,
        compression_ratio_percent: 50,
        path: '/Users/demo/current.mv2',
      },
      kbPath: '/Users/demo/current.mv2',
      isKbOpen: true,
      isLoading: false,
      error: null,
      currentPage: 'home',
      sidebarCollapsed: false,
      selectedDocument: null,
      detailLoading: false,
      darkMode: true,
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
          lastOpenedAt: 2,
          stats: { frame_count: 12, size_bytes: 2048 },
        },
      ],
      activeKbId: null,
      multiKbEnabled: false,
    });

    render(<WorkbenchShell />);

    await waitFor(() => expect(screen.getByText('当前知识库')).toBeInTheDocument());
    expect(screen.getByText('current.mv2')).toBeInTheDocument();
    expect(screen.getByText('其他知识库')).toBeInTheDocument();
    expect(screen.getByText('投资研究')).toBeInTheDocument();
    expect(screen.getByText('最近笔记')).toBeInTheDocument();
    expect(screen.getByText('周会笔记')).toBeInTheDocument();
  });
});

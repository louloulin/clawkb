import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const dialogMock = vi.hoisted(() => ({
  open: vi.fn(),
  save: vi.fn(),
}));

const toastMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/plugin-dialog', () => dialogMock);
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

import { SettingsPage } from '@/components/pages/settings';
import { useAiStore } from '@/store/ai-store';
import { useKbStore } from '@/store/kb-store';
import { useSyncStore } from '@/store/sync-store';

describe('settings page mvp kb setup', () => {
  beforeEach(() => {
    localStorage.clear();
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    dialogMock.open.mockReset();
    dialogMock.save.mockReset();
    toastMock.mockReset();

    useKbStore.setState({
      stats: null,
      kbPath: '',
      isKbOpen: false,
      isLoading: false,
      error: null,
      currentPage: 'settings',
      sidebarCollapsed: false,
      selectedDocument: null,
      detailLoading: false,
      darkMode: true,
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

    useSyncStore.setState({
      webdavConfig: {
        url: '',
        username: '',
        password: '',
        remotePath: '/ClawKB',
        enabled: false,
        lastSync: null,
        lastError: null,
      },
      obsidianConfig: {
        vaultPath: '',
        syncTags: ['obsidian', 'imported'],
        lastScanned: null,
        autoSync: false,
      },
    });
  });

  it('fills the KB path from the native file picker', async () => {
    dialogMock.open.mockResolvedValueOnce('/Users/demo/knowledge.mv2');

    render(<SettingsPage />);

    expect(screen.getByText('知识库设置')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '显示高级设置' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'AI 模型' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '选择已有知识库' }));

    await waitFor(() => expect(dialogMock.open).toHaveBeenCalled());
    expect(await screen.findByDisplayValue('/Users/demo/knowledge.mv2')).toBeInTheDocument();
  });
});

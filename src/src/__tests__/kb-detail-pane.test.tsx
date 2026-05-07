import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { KbDetailPane } from '@/components/spaces/kb-detail-pane';
import type { RegistrySpace } from '@/store/kb-registry-store';

const registeredSpace: RegistrySpace = {
  id: 'space-1',
  name: 'Research Library',
  path: '/kb/research.mv2',
  description: 'Original description',
  collection: 'created',
  kind: 'registered',
  addedAt: 1,
  lastOpenedAt: 2,
  stats: { frame_count: 24, size_bytes: 4096 },
};

describe('space metadata edit smoke', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('submits edited metadata for a registered space', async () => {
    const onSaveMetadata = vi.fn().mockResolvedValue(undefined);

    render(
      <KbDetailPane
        selectedSpace={registeredSpace}
        isCurrent={false}
        switching={false}
        previewQuery="*"
        previewHits={[]}
        previewLoading={false}
        onPreviewQueryChange={vi.fn()}
        onPreviewSearch={vi.fn()}
        onOpenAsk={vi.fn()}
        onOpenNotes={vi.fn()}
        onRegisterCurrent={vi.fn()}
        showRegisterCurrent={false}
        onSaveMetadata={onSaveMetadata}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '编辑知识库设置' }));
    fireEvent.change(screen.getByPlaceholderText('知识库名称'), {
      target: { value: 'Archived Research' },
    });
    fireEvent.change(screen.getByPlaceholderText('一句话说明这个知识库存放什么'), {
      target: { value: 'Updated local archive' },
    });
    fireEvent.click(screen.getByRole('button', { name: /保存知识库设置/i }));

    await waitFor(() =>
      expect(onSaveMetadata).toHaveBeenCalledWith({
        name: 'Archived Research',
        description: 'Updated local archive',
        collection: 'created',
      }),
    );
  });
});

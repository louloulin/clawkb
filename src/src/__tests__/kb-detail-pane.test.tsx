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
        onOpen={vi.fn()}
        onRegisterCurrent={vi.fn()}
        showRegisterCurrent={false}
        onOpenDocuments={vi.fn()}
        onSaveMetadata={onSaveMetadata}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Knowledge space name'), {
      target: { value: 'Archived Research' },
    });
    fireEvent.change(screen.getByPlaceholderText('Short description'), {
      target: { value: 'Updated local archive' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save space metadata/i }));

    await waitFor(() =>
      expect(onSaveMetadata).toHaveBeenCalledWith({
        name: 'Archived Research',
        description: 'Updated local archive',
        collection: 'created',
      }),
    );
  });
});

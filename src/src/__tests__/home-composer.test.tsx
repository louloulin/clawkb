import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeComposer } from '@/components/home/home-composer';

describe('workbench mention scope smoke', () => {
  it('shows the currently selected mention scope in the composer summary rail', () => {
    render(
      <HomeComposer
        input="Summarize my notes"
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        isLoading={false}
        mode="research"
        onModeChange={vi.fn()}
        model="default"
        onModelChange={vi.fn()}
        mention="space-a"
        onMentionChange={vi.fn()}
        mentionOptions={[
          { id: 'current', label: '@Current KB', scopePaths: [] },
          { id: 'space-a', label: '@Research Library', scopePaths: ['/kb/research.mv2'] },
        ]}
        onAttachmentIntent={vi.fn()}
        latestAssistantMessage={undefined}
      />,
    );

    expect(screen.getAllByText('@Research Library')).toHaveLength(2);
    expect(screen.getAllByText('Research').length).toBeGreaterThan(0);
  });
});

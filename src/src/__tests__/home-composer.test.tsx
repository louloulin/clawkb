import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
        onOpenSource={vi.fn()}
        latestAssistantMessage={undefined}
      />,
    );

    expect(screen.getAllByText('@Research Library')).toHaveLength(2);
  });

  it('keeps the composer minimal by hiding advanced controls until requested', () => {
    render(
      <HomeComposer
        input=""
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        isLoading={false}
        mode="conversation"
        onModeChange={vi.fn()}
        model="default"
        onModelChange={vi.fn()}
        mention="current"
        onMentionChange={vi.fn()}
        mentionOptions={[{ id: 'current', label: '@当前知识库', scopePaths: [] }]}
        onAttachmentIntent={vi.fn()}
        onOpenSource={vi.fn()}
        latestAssistantMessage={undefined}
      />,
    );

    expect(screen.getByRole('button', { name: /提问/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /显示高级选项/i })).toBeInTheDocument();
    expect(screen.queryByText('Conversation')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Attach File/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Voice Memo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Screenshot/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Source Preview')).not.toBeInTheDocument();
  });

  it('reveals advanced controls only after the user explicitly expands them', () => {
    render(
      <HomeComposer
        input=""
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        isLoading={false}
        mode="conversation"
        onModeChange={vi.fn()}
        model="default"
        onModelChange={vi.fn()}
        mention="current"
        onMentionChange={vi.fn()}
        mentionOptions={[{ id: 'current', label: '@当前知识库', scopePaths: [] }]}
        onAttachmentIntent={vi.fn()}
        onOpenSource={vi.fn()}
        latestAssistantMessage={undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /显示高级选项/i }));

    expect(screen.getAllByText('对话').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /媒体/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /截图/i })).toBeInTheDocument();
  });

  it('shows source cards by default and lets the user open one', () => {
    const onOpenSource = vi.fn();

    render(
      <HomeComposer
        input=""
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        isLoading={false}
        mode="conversation"
        onModeChange={vi.fn()}
        model="default"
        onModelChange={vi.fn()}
        mention="current"
        onMentionChange={vi.fn()}
        mentionOptions={[{ id: 'current', label: '@当前知识库', scopePaths: [] }]}
        onAttachmentIntent={vi.fn()}
        onOpenSource={onOpenSource}
        latestAssistantMessage={{
          id: 'assistant-1',
          role: 'assistant',
          content: '这是回答',
          timestamp: '2026-04-11T00:00:00Z',
          context: [
            {
              rank: 1,
              frame_id: 'doc-1',
              uri: '/Users/demo/ima-guide.docx',
              title: 'ima知识库使用指南.docx',
              score: 0.8,
              text: '这是来源片段',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('来源')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ima知识库使用指南\.docx/i }));
    expect(onOpenSource).toHaveBeenCalledWith(
      expect.objectContaining({
        frame_id: 'doc-1',
        title: 'ima知识库使用指南.docx',
      }),
    );
  });
});

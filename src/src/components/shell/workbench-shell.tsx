import { useEffect, useMemo, useState, startTransition } from 'react';
import { MessagesSquare } from 'lucide-react';
import { HomeComposer } from '@/components/home/home-composer';
import { HomeHero } from '@/components/home/home-hero';
import { HomeQuickActions } from '@/components/home/home-quick-actions';
import { useChatStore } from '@/store/chat-store';
import { ASK_MODEL_OPTIONS, useAiStore, type AskModel } from '@/store/ai-store';
import { useKbStore } from '@/store/kb-store';
import { useKbRegistry } from '@/store/kb-registry-store';
import { useWorkspaceStore } from '@/store/workspace-store';
import type { ChatMode } from '@/api';

type MentionOption = {
  id: string;
  label: string;
  scopePaths: string[];
};

export function WorkbenchShell() {
  const { messages, isLoading, sendMessage, loadHistory } = useChatStore();
  const { isKbOpen, kbPath, stats, setPage } = useKbStore();
  const registry = useKbRegistry();
  const aiStore = useAiStore();
  const {
    openImportView,
    setActiveDocumentsView,
  } = useWorkspaceStore();
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<ChatMode>('conversation');
  const [mention, setMention] = useState('current');

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant'),
    [messages],
  );

  const mentionOptions = useMemo<MentionOption[]>(() => {
    const base: MentionOption[] = [
      {
        id: 'current',
        label: isKbOpen ? `@${kbPath.split('/').pop() || 'Current KB'}` : '@Current KB',
        scopePaths: [],
      },
    ];

    if (registry.registeredSpaces.length > 0) {
      base.push({
        id: 'created-all',
        label: '@All Registered Spaces',
        scopePaths: registry.registeredSpaces.map((space) => space.path),
      });
    }

    for (const space of registry.registeredSpaces) {
      base.push({
        id: space.id,
        label: `@${space.name}`,
        scopePaths: [space.path],
      });
    }

    return base;
  }, [isKbOpen, kbPath, registry.registeredSpaces]);

  const selectedMention = mentionOptions.find((option) => option.id === mention) ?? mentionOptions[0];

  const handleSend = async () => {
    const question = input.trim();
    if (!question || isLoading) return;
    setInput('');
    await sendMessage(question, {
      mode,
      modelLabel:
        ASK_MODEL_OPTIONS.find((option) => option.value === aiStore.ask.model)?.label ||
        (aiStore.ask.model === 'custom' ? aiStore.ask.customModelName || 'Custom Model' : aiStore.ask.model),
      scopeLabel: selectedMention.label,
      scopePaths: selectedMention.scopePaths,
    });
  };

  const handleQuickAction = (action: 'voice-memo' | 'document-briefing' | 'smart-writing' | 'quick-access') => {
    if (action === 'voice-memo') {
      openImportView('media');
      setPage('explore');
      return;
    }
    if (action === 'document-briefing') {
      setActiveDocumentsView('reader');
      setPage('documents');
      return;
    }
    if (action === 'smart-writing') {
      setActiveDocumentsView('draft');
      setPage('documents');
      return;
    }
    setPage('spaces');
  };

  const handleAttachmentIntent = (intent: 'file' | 'url' | 'media' | 'screenshot') => {
    openImportView(intent);
    setPage('explore');
  };

  const handleModelChange = (model: AskModel) => {
    startTransition(() => {
      aiStore.setAskModel(model);
    });
    void aiStore.applyConfig();
  };

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(190,147,89,0.22),_transparent_28%),radial-gradient(circle_at_80%_18%,_rgba(99,102,241,0.14),_transparent_18%),linear-gradient(180deg,_rgba(12,14,20,1)_0%,_rgba(17,19,27,1)_100%)] text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8 md:px-8 lg:py-12">
        <HomeHero
          kbName={isKbOpen ? kbPath.split('/').pop() || 'Current KB' : 'Not open'}
          docCount={stats?.frame_count ?? 0}
        />

        <HomeComposer
          input={input}
          onInputChange={setInput}
          onSend={handleSend}
          isLoading={isLoading}
          mode={mode}
          onModeChange={setMode}
          model={aiStore.ask.model}
          onModelChange={handleModelChange}
          mention={mention}
          onMentionChange={setMention}
          mentionOptions={mentionOptions}
          onAttachmentIntent={handleAttachmentIntent}
          latestAssistantMessage={latestAssistantMessage}
        />

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <HomeQuickActions onAction={handleQuickAction} />

          <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Recent Stream</div>
            <h2 className="mt-2 text-xl font-semibold text-white">Latest conversation turns</h2>
            <div className="mt-5 space-y-3">
              {messages.length === 0 ? (
                <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-black/20 px-4 py-5 text-sm leading-7 text-slate-400">
                  No conversation yet. Ask the workbench a question and the latest turns will stay visible here.
                </div>
              ) : (
                messages.slice(-6).map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-[1.25rem] border px-4 py-3 ${
                      message.role === 'assistant'
                        ? 'border-white/10 bg-black/25 text-slate-100'
                        : 'border-amber-300/20 bg-amber-300/10 text-amber-50'
                    }`}
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      <span>{message.role === 'assistant' ? 'assistant' : 'you'}</span>
                      {message.mode && <span className="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 normal-case">{message.mode}</span>}
                      {message.modelLabel && <span className="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 normal-case">{message.modelLabel}</span>}
                      {message.scopeLabel && <span className="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 normal-case">{message.scopeLabel}</span>}
                    </div>
                    <div className="line-clamp-5 text-sm leading-6">{message.content}</div>
                    {message.context && message.context.length > 0 && (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] text-slate-300">
                        <MessagesSquare className="h-3.5 w-3.5" />
                        {message.context.length} sources attached
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

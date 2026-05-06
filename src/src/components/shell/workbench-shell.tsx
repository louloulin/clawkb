import { useEffect, useMemo, useState, startTransition } from 'react';
import { FolderCog, LibraryBig, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HomeComposer } from '@/components/home/home-composer';
import { ChatHistory } from '@/components/chat/chat-history';
import { api, type ContextFragment, type TimelineEntry } from '@/api';
import { useChatStore } from '@/store/chat-store';
import { ASK_MODEL_OPTIONS, useAiStore, type AskModel } from '@/store/ai-store';
import { useDocumentWorkspaceStore } from '@/store/document-workspace-store';
import { useKbStore } from '@/store/kb-store';
import { useKbRegistry } from '@/store/kb-registry-store';
import { useWorkspaceStore } from '@/store/workspace-store';
import { resolveSourceHit } from '@/lib/source-navigation';
import type { ChatMode } from '@/api';

type MentionOption = {
  id: string;
  label: string;
  scopePaths: string[];
};

export function WorkbenchShell() {
  const { messages, isLoading, sendMessage, loadHistory } = useChatStore();
  const { isKbOpen, kbPath, openKb, setPage } = useKbStore();
  const registry = useKbRegistry();
  const aiStore = useAiStore();
  const { selectDocument, seedDraftFromDocument, setActiveTab } = useDocumentWorkspaceStore();
  const { openImportView, setActiveDocumentsView } = useWorkspaceStore();
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<ChatMode>('conversation');
  const [mention, setMention] = useState('current');
  const [recentEntries, setRecentEntries] = useState<TimelineEntry[]>([]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!isKbOpen) {
      setRecentEntries([]);
      return;
    }
    let cancelled = false;
    void api.timeline(3).then((entries) => {
      if (!cancelled) setRecentEntries(entries);
    }).catch(() => {
      if (!cancelled) setRecentEntries([]);
    });
    return () => {
      cancelled = true;
    };
  }, [isKbOpen, kbPath]);

  const recentLibraries = useMemo(
    () =>
      [...registry.registeredSpaces]
        .filter((space) => space.path !== kbPath)
        .sort((left, right) => (right.lastOpenedAt ?? right.addedAt) - (left.lastOpenedAt ?? left.addedAt))
        .slice(0, 2),
    [registry.registeredSpaces, kbPath],
  );

  const mentionOptions = useMemo<MentionOption[]>(() => {
    const base: MentionOption[] = [
      {
        id: 'current',
        label: isKbOpen ? `@${kbPath.split('/').pop() || '当前知识库'}` : '@当前知识库',
        scopePaths: [],
      },
    ];

    if (registry.registeredSpaces.length > 0) {
      base.push({
        id: 'created-all',
        label: '@全部本地知识库',
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

  useEffect(() => {
    const activeMention = registry.activeKbId && mentionOptions.some((option) => option.id === registry.activeKbId)
      ? registry.activeKbId
      : 'current';
    setMention(activeMention);
  }, [registry.activeKbId, mentionOptions]);

  const selectedMention = mentionOptions.find((option) => option.id === mention) ?? mentionOptions[0];
  const currentHistoryKey = useMemo(() => {
    if (selectedMention.scopePaths.length > 0) {
      return `scope:${[...selectedMention.scopePaths].sort().join('|')}`;
    }
    if (kbPath) {
      return `scope:${kbPath}`;
    }
    return 'scope:__no_kb__';
  }, [selectedMention.scopePaths, kbPath]);

  const visibleMessages = useMemo(
    () => messages.filter((message) => message.historyKey === currentHistoryKey),
    [messages, currentHistoryKey],
  );

  const latestAssistantMessage = useMemo(
    () => [...visibleMessages].reverse().find((message) => message.role === 'assistant'),
    [visibleMessages],
  );

  const handleSend = async () => {
    const question = input.trim();
    if (!question || isLoading) return;
    setInput('');
    await sendMessage(question, {
      historyKey: currentHistoryKey,
      mode,
      modelLabel:
        ASK_MODEL_OPTIONS.find((option) => option.value === aiStore.ask.model)?.label ||
        (aiStore.ask.model === 'custom' ? aiStore.ask.customModelName || 'Custom Model' : aiStore.ask.model),
      scopeLabel: selectedMention.label,
      scopePaths: selectedMention.scopePaths,
    });
  };

  const handleAttachmentIntent = (intent: 'file' | 'url' | 'media' | 'screenshot') => {
    openImportView(intent);
    setPage('documents');
  };

  const handleModelChange = (model: AskModel) => {
    startTransition(() => {
      aiStore.setAskModel(model);
    });
    void aiStore.applyConfig();
  };

  const handleOpenSource = async (fragment: ContextFragment) => {
    const singleScopedPath =
      selectedMention.scopePaths.length === 1 ? selectedMention.scopePaths[0] : null;

    if (singleScopedPath && singleScopedPath !== kbPath) {
      try {
        const openKbs = await api.listOpenKbs();
        if (!openKbs.includes(singleScopedPath)) {
          await openKb(singleScopedPath);
        }
      } catch {
        // best effort
      }
      const targetKb = registry.registeredSpaces.find((space) => space.path === singleScopedPath);
      if (targetKb) {
        registry.markOpened(targetKb.id);
        registry.setActiveKb(targetKb.id);
      }
    }

    const doc = await resolveSourceHit(
      fragment,
      singleScopedPath && singleScopedPath !== kbPath
        ? [singleScopedPath]
        : selectedMention.scopePaths,
    );
    selectDocument(doc);
    seedDraftFromDocument(doc);
    setActiveDocumentsView('reader');
    setActiveTab('reader');
    setPage('documents');
  };

  return (
    <div className="kb-shell min-h-full text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8 md:px-8 lg:py-12">
        {isKbOpen ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/6 px-3 py-1">
                <MessageSquare className="h-3 w-3" /> 对话记录
              </span>
            </div>

            {/* Chat history above composer */}
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <ChatHistory messages={messages} visibleMessages={visibleMessages} />
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
                当前知识库
              </span>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white">
                {kbPath.split('/').pop() || '当前知识库'}
              </span>
              {recentLibraries.length > 0 && (
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
                  最近库
                </span>
              )}
              {recentLibraries.map((space) => (
                <span
                  key={space.id}
                  className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white"
                >
                  {space.name}
                </span>
              ))}
              {recentEntries.length > 0 && (
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
                  最近资料
                </span>
              )}
              {recentEntries.map((entry) => (
                <span
                  key={entry.id}
                  className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white"
                >
                  {entry.title}
                </span>
              ))}
            </div>

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
              onMentionChange={(nextMention) => {
                setMention(nextMention);
                registry.setActiveKb(nextMention === 'current' || nextMention === 'created-all' ? null : nextMention);
              }}
              mentionOptions={mentionOptions}
              onAttachmentIntent={handleAttachmentIntent}
              onOpenSource={(fragment) => void handleOpenSource(fragment)}
              latestAssistantMessage={latestAssistantMessage}
            />
          </div>
        ) : (
          <section className="rounded-[1.75rem] border border-amber-200/20 bg-[linear-gradient(180deg,_rgba(28,24,18,0.96)_0%,_rgba(14,12,16,0.96)_100%)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-amber-100/80">
              桌面初始化
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">
              先打开一个本地知识库，再开始提问和做笔记
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              首页只保留最短主链路：开库、提问、笔记。挂载知识库之后，再回来继续围绕自己的资料工作。
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                onClick={() => setPage('settings')}
                className="h-11 rounded-full bg-amber-300 px-5 text-sm font-medium text-slate-950 hover:bg-amber-200"
              >
                <FolderCog className="mr-2 h-4 w-4" />
                打开或创建知识库
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage('spaces')}
                className="h-11 rounded-full border-white/10 bg-white/4 px-5 text-sm text-white hover:bg-white/10"
              >
                <LibraryBig className="mr-2 h-4 w-4" />
                管理知识库
              </Button>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

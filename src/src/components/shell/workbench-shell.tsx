import { useEffect, useMemo, useState, startTransition, useCallback } from 'react';
import {
  BookOpen,
  ChevronRight,
  Clock,
  FileText,
  FolderPlus,
  LibraryBig,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Tag,
  TrendingUp,
} from 'lucide-react';
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
import { formatBytes, formatRelativeTime } from '@/lib/format';

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
  const { openImportView, openExploreView, setActiveDocumentsView } = useWorkspaceStore();
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

  // Get today's date for daily note
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);

  // Handle quick actions
  const handleNewNote = useCallback(() => {
    void (async () => {
      try {
        const title = `Untitled ${new Date().toLocaleTimeString()}`;
        await api.addNote(title, '', []);
        const hits = await api.search(title, 1, 'lex');
        if (hits.length > 0) {
          useKbStore.getState().openDocument(hits[0]);
          setPage('editor');
        }
      } catch (err) {
        console.error('创建笔记失败:', err);
      }
    })();
  }, [setPage]);

  const handleOpenDailyNote = useCallback(() => {
    const dailyTitle = `Daily Note ${dateStr}`;
    void (async () => {
      try {
        const hits = await api.search(dailyTitle, 1, 'lex');
        if (hits.length > 0 && hits[0].title === dailyTitle) {
          useKbStore.getState().openDocument(hits[0]);
        } else {
          const template = `# ${dateStr}\n\n## 今日待办\n\n- [ ] \n\n## 笔记\n\n`;
          await api.addNote(dailyTitle, template, ['daily']);
          const newHits = await api.search(dailyTitle, 1, 'lex');
          if (newHits.length > 0) {
            useKbStore.getState().openDocument(newHits[0]);
          }
        }
        setPage('editor');
      } catch (err) {
        console.error('打开日记失败:', err);
      }
    })();
  }, [dateStr, setPage]);

  const handleSearch = useCallback(() => {
    openExploreView('search');
    setPage('documents');
  }, [openExploreView, setPage]);

  const handleOpenGraph = useCallback(() => {
    openExploreView('graph');
    setPage('documents');
  }, [openExploreView, setPage]);

  // Get stats for stats card
  const stats = useKbStore((s) => s.stats);

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 md:px-8 lg:py-10">
        {isKbOpen ? (
          <>
            {/* Header with stats and quick actions */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold text-foreground">工作台</h1>
                <p className="text-sm text-muted-foreground">欢迎回来，今天是 {dateStr}</p>
              </div>
              <Button
                onClick={handleNewNote}
                className="h-10 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="mr-2 h-4 w-4" />
                新建笔记
              </Button>
            </div>

            {/* Stats Cards Row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Notes Count */}
              <div className="kb-panel-strong rounded-2xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-semibold text-foreground">{stats?.frame_count ?? 0}</div>
                    <div className="text-xs text-muted-foreground">笔记总数</div>
                  </div>
                </div>
              </div>

              {/* KB Size */}
              <div className="kb-panel-strong rounded-2xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <LibraryBig className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-semibold text-foreground">{stats ? formatBytes(stats.size_bytes) : '-'}</div>
                    <div className="text-xs text-muted-foreground">知识库大小</div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="kb-panel-strong rounded-2xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-semibold text-foreground">{recentEntries.length}</div>
                    <div className="text-xs text-muted-foreground">最近活跃</div>
                  </div>
                </div>
              </div>

              {/* Daily Note */}
              <button
                onClick={handleOpenDailyNote}
                className="kb-panel-strong rounded-2xl border border-border p-4 text-left transition hover:border-primary/30 hover:bg-primary/5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">今日日记</div>
                    <div className="text-xs text-muted-foreground">{dateStr}</div>
                  </div>
                </div>
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleSearch}
                className="h-10 rounded-full border-border bg-secondary px-4 text-sm text-foreground hover:bg-accent"
              >
                <Search className="mr-2 h-4 w-4" />
                搜索
              </Button>
              <Button
                variant="outline"
                onClick={handleOpenGraph}
                className="h-10 rounded-full border-border bg-secondary px-4 text-sm text-foreground hover:bg-accent"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                图谱
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage('tags')}
                className="h-10 rounded-full border-border bg-secondary px-4 text-sm text-foreground hover:bg-accent"
              >
                <Tag className="mr-2 h-4 w-4" />
                标签
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage('spaces')}
                className="h-10 rounded-full border-border bg-secondary px-4 text-sm text-foreground hover:bg-accent"
              >
                <LibraryBig className="mr-2 h-4 w-4" />
                知识库
              </Button>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Left Column: Recent Notes + Quick Note Creation */}
              <div className="lg:col-span-2 space-y-4">
                {/* Recent Notes */}
                <div className="kb-panel-strong rounded-2xl border border-border p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-medium text-foreground">最近笔记</h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { openExploreView('notes'); setPage('documents'); }}
                      className="h-8 rounded-full text-xs text-muted-foreground hover:text-foreground"
                    >
                      查看全部
                      <ChevronRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                  {recentEntries.length > 0 ? (
                    <div className="space-y-2">
                      {recentEntries.slice(0, 5).map((entry) => (
                        <button
                          key={entry.id}
                          onClick={() => {
                            useKbStore.getState().openDocument(entry);
                            setPage('editor');
                          }}
                          className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition hover:border-border hover:bg-secondary"
                        >
                          <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-foreground">{entry.title}</div>
                            <div className="text-xs text-muted-foreground">{formatRelativeTime(entry.modified)}</div>
                          </div>
                          {entry.tags && entry.tags.length > 0 && (
                            <div className="flex gap-1">
                              {entry.tags.slice(0, 2).map((tag) => (
                                <span key={tag} className="rounded-full bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <FileText className="h-10 w-10 text-muted-foreground/70" />
                      <p className="mt-3 text-sm text-muted-foreground">暂无笔记</p>
                      <Button
                        onClick={handleNewNote}
                        variant="outline"
                        size="sm"
                        className="mt-3 h-8 rounded-full border-border bg-secondary text-sm text-foreground hover:bg-accent"
                      >
                        <Plus className="mr-1.5 h-3 w-3" />
                        创建第一篇笔记
                      </Button>
                    </div>
                  )}
                </div>

                {/* AI Chat Area */}
                <div className="kb-panel-strong rounded-2xl border border-border p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-medium text-foreground">AI 对话</h2>
                    <span className="rounded-full bg-muted/50 px-2.5 py-1 text-[10px] text-muted-foreground">
                      {selectedMention?.label ?? '@当前知识库'}
                    </span>
                  </div>

                  {/* Chat history above composer */}
                  <div className="rounded-xl border border-border bg-secondary p-3 mb-4">
                    <ChatHistory messages={messages} visibleMessages={visibleMessages} />
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
              </div>

              {/* Right Column: KB Info + Recent Libraries */}
              <div className="space-y-4">
                {/* Current KB Info */}
                <div className="kb-panel-strong rounded-2xl border border-border p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-400" />
                    <h3 className="text-sm font-medium text-foreground">当前知识库</h3>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{kbPath.split('/').pop()}</div>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{stats?.frame_count ?? 0} 篇</span>
                    <span>{stats ? formatBytes(stats.size_bytes) : '-'}</span>
                  </div>
                </div>

                {/* Recent Libraries */}
                {recentLibraries.length > 0 && (
                  <div className="kb-panel-strong rounded-2xl border border-border p-4">
                    <h3 className="mb-3 text-sm font-medium text-foreground">其他知识库</h3>
                    <div className="space-y-2">
                      {recentLibraries.map((space) => (
                        <button
                          key={space.id}
                          onClick={() => {
                            openKb(space.path).then(() => {
                              registry.setActiveKb(space.id);
                            });
                          }}
                          className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition hover:border-border hover:bg-secondary"
                        >
                          <LibraryBig className="h-4 w-4 shrink-0 text-amber-200" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm text-foreground">{space.name}</div>
                            <div className="text-xs text-muted-foreground">{space.path.split('/').pop()}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <section className="rounded-[1.75rem] border border-amber-200/20 bg-card p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-primary">
              桌面初始化
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-foreground sm:text-3xl">
              先打开一个本地知识库，再开始提问和做笔记
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-foreground/80">
              首页只保留最短主链路：开库、提问、笔记。挂载知识库之后，再回来继续围绕自己的资料工作。
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                onClick={() => setPage('settings')}
                className="h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <FolderPlus className="mr-2 h-4 w-4" />
                打开或创建知识库
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage('spaces')}
                className="h-11 rounded-full border-border bg-secondary px-5 text-sm text-foreground hover:bg-accent"
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

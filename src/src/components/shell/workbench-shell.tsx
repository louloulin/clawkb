import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpenText,
  BrainCircuit,
  LibraryBig,
  Loader2,
  MessagesSquare,
  Plus,
  Send,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/store/chat-store';
import { useKbStore } from '@/store/kb-store';
import { useWorkspaceStore } from '@/store/workspace-store';

const QUICK_ACTIONS = [
  {
    id: 'search',
    title: 'Search Library',
    description: 'Dive into your imported sources and notes.',
    icon: LibraryBig,
  },
  {
    id: 'import',
    title: 'Import Sources',
    description: 'Bring files, pages, media and screenshots into the KB.',
    icon: Upload,
  },
  {
    id: 'notes',
    title: 'Capture Notes',
    description: 'Write down raw ideas before they disappear.',
    icon: Plus,
  },
  {
    id: 'spaces',
    title: 'Open Spaces',
    description: 'Jump into your current and registered knowledge spaces.',
    icon: BookOpenText,
  },
] as const;

export function WorkbenchShell() {
  const { messages, isLoading, sendMessage, loadHistory } = useChatStore();
  const { isKbOpen, kbPath, stats, setPage } = useKbStore();
  const { openExploreView } = useWorkspaceStore();
  const [input, setInput] = useState('');

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const recentMessages = useMemo(() => messages.slice(-6), [messages]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || isLoading) return;
    setInput('');
    await sendMessage(question);
  };

  const handleQuickAction = (action: (typeof QUICK_ACTIONS)[number]['id']) => {
    if (action === 'spaces') {
      setPage('spaces');
      return;
    }
    openExploreView(action);
    setPage('explore');
  };

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(190,147,89,0.22),_transparent_28%),radial-gradient(circle_at_80%_18%,_rgba(99,102,241,0.14),_transparent_18%),linear-gradient(180deg,_rgba(12,14,20,1)_0%,_rgba(17,19,27,1)_100%)] text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8 md:px-8 lg:py-12">
        <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-200/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-amber-100/80">
                <Sparkles className="h-3.5 w-3.5" />
                Workbench
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Ask, collect, and move through your knowledge without leaving the workspace.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                ClawKB now opens as a workbench instead of a utility dashboard. Start with a question,
                route into search/import/notes when needed, and keep your current knowledge base in view.
              </p>
            </div>

            <div className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-sm text-slate-200 sm:grid-cols-3 lg:min-w-[360px]">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Knowledge Base</div>
                <div className="mt-1 font-medium text-white">{isKbOpen ? kbPath.split('/').pop() : 'Not open'}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Documents</div>
                <div className="mt-1 font-medium text-white">{stats?.frame_count ?? 0}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Mode</div>
                <div className="mt-1 inline-flex items-center gap-2 font-medium text-emerald-300">
                  <BrainCircuit className="h-4 w-4" />
                  Chat-first
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-[1.75rem] border border-white/10 bg-black/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder={isKbOpen ? '基于当前知识库提问，或者开始一段新的工作流…' : '先打开一个知识库，或者先用 Demo 模式提问…'}
              className="min-h-[128px] w-full resize-none border-none bg-transparent text-base leading-7 text-white placeholder:text-slate-500 focus:outline-none"
            />
            <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">Conversation mode</span>
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">RAG ready</span>
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">Local-first</span>
              </div>
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="h-11 rounded-full bg-amber-300 px-5 text-sm font-medium text-slate-950 hover:bg-amber-200"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Ask Workbench
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Quick Routes</div>
                <h2 className="mt-2 text-xl font-semibold text-white">Move into the right workflow fast</h2>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => handleQuickAction(action.id)}
                    className="group rounded-[1.25rem] border border-white/10 bg-black/20 p-4 text-left transition hover:border-amber-200/40 hover:bg-black/35"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8 text-amber-200">
                        <Icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:text-amber-200" />
                    </div>
                    <div className="mt-4 text-base font-medium text-white">{action.title}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{action.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Recent Stream</div>
            <h2 className="mt-2 text-xl font-semibold text-white">Latest conversation turns</h2>
            <div className="mt-5 space-y-3">
              {recentMessages.length === 0 ? (
                <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-black/20 px-4 py-5 text-sm leading-7 text-slate-400">
                  No conversation yet. Ask the workbench a question and the latest turns will stay visible here.
                </div>
              ) : (
                recentMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-[1.25rem] border px-4 py-3 ${
                      message.role === 'assistant'
                        ? 'border-white/10 bg-black/25 text-slate-100'
                        : 'border-amber-300/20 bg-amber-300/10 text-amber-50'
                    }`}
                  >
                    <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      {message.role === 'assistant' ? 'assistant' : 'you'}
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

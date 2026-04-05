import { useEffect, useState } from 'react';
import { BookOpenText, Loader2, MessageSquareQuote, Search, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/api';
import type { AskResult, SearchHit } from '@/api';
import type { RegistrySpace } from '@/store/kb-registry-store';
import { useKbStore } from '@/store/kb-store';

interface KbChatPaneProps {
  selectedSpace: RegistrySpace | null;
  isCurrent: boolean;
  onEnsureSpaceReady: () => Promise<void>;
}

export function KbChatPane({ selectedSpace, isCurrent, onEnsureSpaceReady }: KbChatPaneProps) {
  const openDocument = useKbStore((state) => state.openDocument);
  const [question, setQuestion] = useState('');
  const [browseQuery, setBrowseQuery] = useState('*');
  const [answer, setAnswer] = useState<AskResult | null>(null);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [asking, setAsking] = useState(false);
  const [browsing, setBrowsing] = useState(false);

  useEffect(() => {
    if (!selectedSpace) return;
    void handleBrowse('*');
  }, [selectedSpace?.id]);

  const handleAsk = async () => {
    if (!selectedSpace || !question.trim()) return;
    setAsking(true);
    try {
      await onEnsureSpaceReady();
      const result = isCurrent
        ? await api.aiAsk(question, 6)
        : (await api.aiAskMulti(question, [selectedSpace.path], 6)).result;
      setAnswer(result);
    } finally {
      setAsking(false);
    }
  };

  const handleBrowse = async (value = browseQuery) => {
    if (!selectedSpace) return;
    setBrowsing(true);
    try {
      await onEnsureSpaceReady();
      const normalized = value.trim() || '*';
      const results = isCurrent
        ? await api.search(normalized, 8, 'hybrid')
        : await api.searchMultiKb(normalized, [selectedSpace.path], 8, 'hybrid');
      setHits(results);
      setBrowseQuery(normalized);
    } finally {
      setBrowsing(false);
    }
  };

  if (!selectedSpace) {
    return (
      <div className="rounded-[1.8rem] border border-dashed border-white/10 bg-black/20 p-5 text-sm leading-7 text-slate-400">
        Pick a knowledge space first. The right pane becomes the entry point for asking that space and previewing its top documents.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-[1.8rem] border border-white/10 bg-black/20">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-400">
          <MessageSquareQuote className="h-3.5 w-3.5" />
          Space Console
        </div>
        <h3 className="mt-2 text-lg font-semibold text-white">Ask and browse inside {selectedSpace.name}</h3>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="rounded-[1.25rem] border border-white/10 bg-white/4 p-3">
          <div className="flex gap-2">
            <Input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleAsk();
                }
              }}
              placeholder={`Ask ${selectedSpace.name}…`}
              className="h-11 rounded-full border-white/10 bg-black/20 text-white placeholder:text-slate-500"
            />
            <Button
              onClick={() => void handleAsk()}
              disabled={!question.trim() || asking}
              className="h-11 rounded-full bg-amber-300 px-4 text-slate-950 hover:bg-amber-200"
            >
              {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          {answer && (
            <div className="mt-4 rounded-[1.1rem] border border-white/10 bg-black/20 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Latest Answer</div>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-100">
                {answer.answer || 'No synthesized answer returned.'}
              </div>
              {answer.context.length > 0 && (
                <div className="mt-4 text-xs text-slate-400">{answer.context.length} sources attached to this answer</div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-[1.25rem] border border-white/10 bg-white/4 p-3">
          <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
            <BookOpenText className="h-3.5 w-3.5" />
            Browse Documents
          </div>
          <div className="flex gap-2">
            <Input
              value={browseQuery}
              onChange={(event) => setBrowseQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleBrowse();
                }
              }}
              placeholder="Search or use * for recent docs"
              className="h-10 rounded-full border-white/10 bg-black/20 text-white placeholder:text-slate-500"
            />
            <Button
              onClick={() => void handleBrowse()}
              disabled={browsing}
              variant="outline"
              className="h-10 rounded-full border-white/10 bg-white/6 px-4 text-white hover:bg-white/10"
            >
              {browsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          <ScrollArea className="mt-4 h-[320px]">
            <div className="space-y-3 pr-2">
              {hits.length === 0 ? (
                <div className="rounded-[1rem] border border-dashed border-white/10 bg-black/20 p-4 text-sm leading-7 text-slate-400">
                  No results yet. Run a browse query to inspect documents in this space.
                </div>
              ) : (
                hits.map((hit) => (
                  <button
                    key={`${selectedSpace.id}-${hit.id}-${hit.title}`}
                    onClick={() => openDocument(hit)}
                    className="w-full rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-left transition hover:border-white/20 hover:bg-black/30"
                  >
                    <div className="text-sm font-medium text-white">{hit.title}</div>
                    <div className="mt-2 line-clamp-3 text-xs leading-6 text-slate-400">{hit.content}</div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Clock, ChevronDown, Timer, Search, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { api } from '@/api';
import { useKbStore } from '@/store/kb-store';
import type { TimelineEntry, SearchHit, AsOfResult } from '@/api';

export function TimelinePage() {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [showTimeMachine, setShowTimeMachine] = useState(false);
  const [timeMachineTs, setTimeMachineTs] = useState(Math.floor(Date.now() / 1000) - 86400);
  const [tmQuery, setTmQuery] = useState('');
  const [tmResults, setTmResults] = useState<SearchHit[]>([]);
  const [tmAnswer, setTmAnswer] = useState<AsOfResult | null>(null);
  const [tmLoading, setTmLoading] = useState(false);
  const openDocumentByTitle = useKbStore(s => s.openDocumentByTitle);
  const openDocument = useKbStore(s => s.openDocument);
  const detailLoading = useKbStore(s => s.detailLoading);

  useEffect(() => {
    setLoading(true);
    api.timeline(limit)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [limit]);

  const handleClick = (entry: TimelineEntry) => {
    openDocumentByTitle(entry.title);
  };

  const handleTimeMachineSearch = async () => {
    if (!tmQuery.trim()) return;
    setTmLoading(true);
    setTmAnswer(null);
    try {
      const results = await api.searchAsOf(tmQuery, timeMachineTs, 5);
      setTmResults(results);
    } catch {
      setTmResults([]);
    }
    setTmLoading(false);
  };

  const handleTimeMachineAsk = async () => {
    if (!tmQuery.trim()) return;
    setTmLoading(true);
    setTmResults([]);
    try {
      const result = await api.askAsOf(tmQuery, timeMachineTs, 5);
      setTmAnswer(result);
    } catch {
      setTmAnswer(null);
    }
    setTmLoading(false);
  };

  const formatTmDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleString();
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-1">Timeline</h2>
          <p className="text-sm text-muted-foreground">Recent activity across your knowledge base</p>
        </div>
        <Button
          variant={showTimeMachine ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowTimeMachine(!showTimeMachine)}
          className="text-xs gap-1.5"
        >
          <Timer className="h-3.5 w-3.5" />
          Time Machine
        </Button>
      </div>

      {/* Time Machine Panel */}
      {showTimeMachine && (
        <div className="mb-6 p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 mb-3">
            <Timer className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">Knowledge Base Time Machine</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Query your knowledge base as it was at a specific point in time
          </p>
          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Point in time:</label>
            <input
              type="datetime-local"
              value={new Date(timeMachineTs * 1000).toISOString().slice(0, 16)}
              onChange={e => {
                const ts = Math.floor(new Date(e.target.value).getTime() / 1000);
                setTimeMachineTs(ts);
              }}
              className="flex-1 bg-background rounded-md border px-2 py-1 text-xs"
            />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Input
              value={tmQuery}
              onChange={e => setTmQuery(e.target.value)}
              placeholder="Ask or search at that point in time..."
              className="text-xs h-8"
              onKeyDown={e => e.key === 'Enter' && handleTimeMachineSearch()}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleTimeMachineSearch}
              disabled={tmLoading || !tmQuery.trim()}
              className="h-8 text-xs gap-1"
            >
              <Search className="h-3 w-3" />
              Search
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTimeMachineAsk}
              disabled={tmLoading || !tmQuery.trim()}
              className="h-8 text-xs gap-1"
            >
              <MessageSquare className="h-3 w-3" />
              Ask
            </Button>
          </div>

          {tmLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
              <Loader2 className="h-3 w-3 animate-spin" />
              Traveling through time...
            </div>
          )}

          {tmResults.length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] font-medium text-muted-foreground mb-2">
                Results as of {formatTmDate(timeMachineTs)}
              </div>
              <div className="space-y-1.5">
                {tmResults.map(hit => (
                  <button
                    key={hit.id}
                    onClick={() => openDocument(hit)}
                    className="w-full text-left p-2 rounded-lg border bg-background hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-medium truncate">{hit.title || '(untitled)'}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{hit.content}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px] h-4 px-1">
                        Score: {hit.score.toFixed(2)}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tmAnswer && (
            <div className="mt-3 p-3 rounded-lg border bg-primary/5">
              <div className="text-[10px] font-medium text-muted-foreground mb-1">
                AI Answer as of {formatTmDate(tmAnswer.timestamp_cutoff)}
              </div>
              <div className="text-xs leading-relaxed">{tmAnswer.answer}</div>
              {tmAnswer.citations.length > 0 && (
                <div className="mt-2 text-[10px] text-muted-foreground">
                  {tmAnswer.citations.length} citation(s)
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-4 p-3">
              <Skeleton className="h-3 w-20 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-3/4 rounded-lg" />
                <Skeleton className="h-2.5 w-1/2 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
            <Clock className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-muted-foreground mb-1">No entries yet</p>
          <p className="text-xs text-muted-foreground/60">Add notes or import files to see activity</p>
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map(entry => (
            <button
              key={entry.id}
              onClick={() => handleClick(entry)}
              disabled={detailLoading}
              className="w-full text-left flex gap-4 p-3 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer group"
            >
              <div className="text-[11px] text-muted-foreground/60 whitespace-nowrap pt-0.5 w-28 shrink-0 tabular-nums">
                {entry.timestamp}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium truncate group-hover:text-primary transition-colors">{entry.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{entry.snippet}</div>
              </div>
            </button>
          ))}
          <Button
            variant="ghost"
            onClick={() => setLimit(prev => prev + 20)}
            className="w-full gap-2 rounded-xl text-muted-foreground hover:text-foreground mt-2"
          >
            <ChevronDown className="h-4 w-4" /> Load more
          </Button>
        </div>
      )}
    </div>
  );
}

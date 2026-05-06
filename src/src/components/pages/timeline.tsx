import { useState, useEffect, useCallback } from 'react';
import { Clock, ChevronDown, Timer, Search, Loader2, MessageSquare, GitCompare, Plus, Minus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { api } from '@/api';
import { useKbStore } from '@/store/kb-store';
import type { TimelineEntry, SearchHit, AsOfResult, CompareResult } from '@/api';

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

  // Compare mode state
  const [showCompare, setShowCompare] = useState(false);
  const [compareQuery, setCompareQuery] = useState('');
  const [earlierTs, setEarlierTs] = useState(Math.floor(Date.now() / 1000) - 7 * 86400);
  const [laterTs, setLaterTs] = useState(Math.floor(Date.now() / 1000));
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

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

  const handleCompare = useCallback(async () => {
    if (!compareQuery.trim()) return;
    setCompareLoading(true);
    setCompareError(null);
    try {
      const result = await api.compareTimeline(compareQuery, earlierTs, laterTs, 20);
      setCompareResult(result);
    } catch (e) {
      setCompareError(String(e));
    }
    setCompareLoading(false);
  }, [compareQuery, earlierTs, laterTs]);

  const formatDate = (ts: number) => new Date(ts * 1000).toLocaleString();
  const formatShortDate = (ts: number) => new Date(ts * 1000).toLocaleDateString();

  const statusColors: Record<string, string> = {
    added: 'bg-green-500/10 text-green-600 border-green-500/20',
    removed: 'bg-red-500/10 text-red-600 border-red-500/20',
    changed: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    unchanged: 'bg-muted text-muted-foreground border-transparent',
  };

  const statusIcons: Record<string, React.ReactNode> = {
    added: <Plus className="h-2.5 w-2.5" />,
    removed: <Minus className="h-2.5 w-2.5" />,
    changed: <RefreshCw className="h-2.5 w-2.5" />,
    unchanged: null,
  };

  const countByStatus = (hits: CompareResult['later_hits']) => {
    const counts = { added: 0, removed: 0, changed: 0, unchanged: 0 };
    for (const h of hits) {
      if (h.status in counts) counts[h.status as keyof typeof counts]++;
    }
    return counts;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-1">Timeline</h2>
          <p className="text-sm text-muted-foreground">Recent activity across your knowledge base</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showCompare ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setShowCompare(!showCompare); setShowTimeMachine(false); }}
            className="text-xs gap-1.5"
          >
            <GitCompare className="h-3.5 w-3.5" />
            Compare
          </Button>
          <Button
            variant={showTimeMachine ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setShowTimeMachine(!showTimeMachine); setShowCompare(false); }}
            className="text-xs gap-1.5"
          >
            <Timer className="h-3.5 w-3.5" />
            Time Machine
          </Button>
        </div>
      </div>

      {/* Compare Panel */}
      {showCompare && (
        <div className="mb-6 p-4 rounded-xl border bg-card space-y-4">
          <div className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">Compare Two Time Points</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            See what documents were added, removed, or changed between two dates
          </p>

          {/* Query input */}
          <Input
            value={compareQuery}
            onChange={e => setCompareQuery(e.target.value)}
            placeholder="Enter a search query to compare..."
            className="text-xs h-8"
            onKeyDown={e => e.key === 'Enter' && handleCompare()}
          />

          {/* Time point selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Earlier point
              </label>
              <input
                type="datetime-local"
                value={new Date(earlierTs * 1000).toISOString().slice(0, 16)}
                onChange={e => setEarlierTs(Math.floor(new Date(e.target.value).getTime() / 1000))}
                className="w-full dark:bg-background bg-white rounded-md border px-2 py-1.5 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Later point
              </label>
              <input
                type="datetime-local"
                value={new Date(laterTs * 1000).toISOString().slice(0, 16)}
                onChange={e => setLaterTs(Math.floor(new Date(e.target.value).getTime() / 1000))}
                className="w-full dark:bg-background bg-white rounded-md border px-2 py-1.5 text-xs"
              />
            </div>
          </div>

          <Button
            onClick={handleCompare}
            disabled={compareLoading || !compareQuery.trim()}
            size="sm"
            className="text-xs gap-1.5"
          >
            {compareLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitCompare className="h-3 w-3" />}
            {compareLoading ? 'Comparing...' : 'Compare'}
          </Button>

          {compareError && (
            <div className="text-xs text-destructive p-2 rounded bg-destructive/10">{compareError}</div>
          )}

          {compareResult && !compareLoading && (
            <div className="space-y-4">
              {/* Summary stats */}
              {(() => {
                const counts = countByStatus(compareResult.later_hits);
                const removed = compareResult.earlier_hits.filter(h => h.status === 'removed').length;
                return (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-muted-foreground">Changes:</span>
                    {removed > 0 && (
                      <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-[11px] gap-1">
                        <Minus className="h-2.5 w-2.5" /> {removed} removed
                      </Badge>
                    )}
                    {counts.added > 0 && (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[11px] gap-1">
                        <Plus className="h-2.5 w-2.5" /> {counts.added} added
                      </Badge>
                    )}
                    {counts.changed > 0 && (
                      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[11px] gap-1">
                        <RefreshCw className="h-2.5 w-2.5" /> {counts.changed} changed
                      </Badge>
                    )}
                    {removed === 0 && counts.added === 0 && counts.changed === 0 && (
                      <Badge className="text-[11px]">No changes</Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground ml-auto">
                      {formatShortDate(compareResult.earlier_timestamp)} → {formatShortDate(compareResult.later_timestamp)}
                    </span>
                  </div>
                );
              })()}

              {/* Side-by-side comparison */}
              <div className="grid grid-cols-2 gap-3">
                {/* Earlier column */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {formatShortDate(compareResult.earlier_timestamp)} ({compareResult.earlier_hits.length} results)
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-[400px] overflow-auto">
                    {compareResult.earlier_hits.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No results</p>
                    ) : (
                      compareResult.earlier_hits.map(hit => (
                        <div
                          key={hit.id}
                          className={`p-2.5 rounded-lg border text-xs space-y-1 ${statusColors[hit.status]}`}
                        >
                          <div className="flex items-center gap-1.5">
                            {statusIcons[hit.status]}
                            <span className="font-medium truncate flex-1">{hit.title || '(untitled)'}</span>
                          </div>
                          <div className="text-muted-foreground line-clamp-2 leading-relaxed">{hit.snippet}</div>
                          <div className="text-muted-foreground/60 text-[10px]">
                            Score: {hit.score.toFixed(2)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Later column */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {formatShortDate(compareResult.later_timestamp)} ({compareResult.later_hits.length} results)
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-[400px] overflow-auto">
                    {compareResult.later_hits.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No results</p>
                    ) : (
                      compareResult.later_hits.map(hit => (
                        <div
                          key={hit.id}
                          className={`p-2.5 rounded-lg border text-xs space-y-1 cursor-pointer hover:bg-muted/30 transition-colors ${statusColors[hit.status]}`}
                          onClick={() => openDocument({ id: hit.id, title: hit.title, content: hit.snippet, score: hit.score, tags: [], created_at: '', source: null })}
                        >
                          <div className="flex items-center gap-1.5">
                            {statusIcons[hit.status]}
                            <span className="font-medium truncate flex-1">{hit.title || '(untitled)'}</span>
                            {hit.score_change !== null && hit.score_change !== 0 && (
                              <span className={`text-[10px] shrink-0 ${hit.score_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {hit.score_change > 0 ? '+' : ''}{hit.score_change.toFixed(2)}
                              </span>
                            )}
                          </div>
                          <div className="text-muted-foreground line-clamp-2 leading-relaxed">{hit.snippet}</div>
                          <div className="text-muted-foreground/60 text-[10px]">
                            Score: {hit.score.toFixed(2)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
              className="flex-1 dark:bg-background bg-white rounded-md border px-2 py-1 text-xs"
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
                Results as of {formatDate(timeMachineTs)}
              </div>
              <div className="space-y-1.5">
                {tmResults.map(hit => (
                  <button
                    key={hit.id}
                    onClick={() => openDocument(hit)}
                    className="w-full text-left p-2 rounded-lg border dark:bg-background bg-white hover:bg-muted/30 transition-colors cursor-pointer"
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
                AI Answer as of {formatDate(tmAnswer.timestamp_cutoff)}
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

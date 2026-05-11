import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Loader2, Hash, X, CheckSquare, Square, Tag, Download, Filter, GitBranch, Clock, ArrowUpDown, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSearch } from '@/hooks';
import { useTags } from '@/hooks';
import { useDocumentWorkspaceStore } from '@/store/document-workspace-store';
import { useKbStore } from '@/store/kb-store';
import { useFolderStore } from '@/store/folder-store';
import { useWorkspaceStore } from '@/store/workspace-store';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/api';
import { classifyAppError, userInputError } from '@/lib/app-error';
import type { SearchHit, SearchMode } from '@/api';

// Search history management
const SEARCH_HISTORY_KEY = 'clawkb-search-history';
const MAX_HISTORY = 10;

function getSearchHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function addToSearchHistory(query: string) {
  if (!query.trim()) return;
  const history = getSearchHistory().filter(q => q !== query);
  history.unshift(query);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

function clearSearchHistory() {
  localStorage.removeItem(SEARCH_HISTORY_KEY);
}

// Time filter options
type TimeFilter = 'all' | 'today' | 'week' | 'month' | 'year';
// Sort options
type SortOption = 'relevance' | 'time';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('hybrid');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [graphPattern, setGraphPattern] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchTag, setBatchTag] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [graphResults, setGraphResults] = useState<SearchHit[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const { results, loading, search } = useSearch();
  const { tags } = useTags();
  const setPage = useKbStore(s => s.setPage);
  const { selectedFolder, selectFolder } = useFolderStore();
  const setActiveDocumentsView = useWorkspaceStore(s => s.setActiveDocumentsView);
  const selectDocument = useDocumentWorkspaceStore(s => s.selectDocument);
  const seedDraftFromDocument = useDocumentWorkspaceStore(s => s.seedDraftFromDocument);
  const setActiveTab = useDocumentWorkspaceStore(s => s.setActiveTab);
  const { toast } = useToast();

  // Load search history on mount
  useEffect(() => {
    setSearchHistory(getSearchHistory());
  }, []);

  const handleSearch = useCallback(async (overrideQuery?: string) => {
    const q = overrideQuery ?? query;
    setSelectedIds(new Set());
    setShowHistory(false);
    try {
      if (!q.trim() && !selectedFolder) {
        toast(userInputError('Enter a search query, or switch to a folder-scoped search before running this action.'));
        return;
      }

      // Save to history
      if (q.trim()) {
        addToSearchHistory(q.trim());
        setSearchHistory(getSearchHistory());
      }

      if (selectedFolder) {
        const hits = await api.searchInFolder(selectedFolder.id, q || '*', 20, mode);
        setGraphResults(hits);
        return;
      }
      // Use graph-enhanced search if pattern is provided
      if (graphPattern.trim()) {
        const hits = await api.searchWithGraph(q, graphPattern, 20, mode);
        setGraphResults(hits);
      } else {
        await search(q, mode);
        setGraphResults([]);
      }
    } catch (error) {
      setGraphResults([]);
      toast(
        classifyAppError(error, {
          fallback: 'Search could not complete. Check that your local knowledge base is open and try again.',
        }),
      );
    }
  }, [query, mode, search, graphPattern, selectedFolder, toast]);

  const displayResults = graphResults.length > 0 ? graphResults : (results ?? []);

  // Filter by tag
  let filteredResults = tagFilter
    ? displayResults.filter(h => h.tags.includes(tagFilter))
    : displayResults;

  // Filter by time
  if (timeFilter !== 'all') {
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    const thresholds: Record<TimeFilter, number> = {
      all: Infinity,
      today: msPerDay,
      week: 7 * msPerDay,
      month: 30 * msPerDay,
      year: 365 * msPerDay,
    };
    const threshold = thresholds[timeFilter];
    filteredResults = filteredResults.filter(h => {
      const docTime = new Date(h.created_at).getTime();
      return now - docTime <= threshold;
    });
  }

  // Sort results
  if (sortBy === 'time') {
    filteredResults = [...filteredResults].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredResults.map(r => r.id)));
    }
  };

  const handleBatchExport = async () => {
    const selected = filteredResults.filter(r => selectedIds.has(r.id));
    const data = selected.map(d => ({ title: d.title, content: d.content, tags: d.tags }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clawkb-export.json';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${selected.length} documents exported.` });
  };

  const handleOpenResult = (hit: SearchHit) => {
    selectDocument(hit);
    seedDraftFromDocument(hit);
    setActiveDocumentsView('reader');
    setActiveTab('reader');
    setPage('reader');
  };

  const handleBatchTag = async () => {
    if (!batchTag.trim()) return;
    setBatchLoading(true);
    try {
      const tagList = batchTag.split(',').map(t => t.trim()).filter(Boolean);
      const selected = filteredResults.filter(r => selectedIds.has(r.id));
      for (const doc of selected) {
        const allTags = [...new Set([...doc.tags, ...tagList])];
        await api.setDocumentTags(doc.id, allTags);
      }
      await api.commit();
      toast({ title: 'Tags added', description: `${selected.length} documents tagged with ${tagList.join(', ')}.` });
      setBatchTag('');
      setSelectedIds(new Set());
      await handleSearch();
    } catch (e) {
      toast(
        classifyAppError(e, {
          fallback: 'Batch tagging failed. Try again after confirming the selected documents still exist in the current knowledge base.',
        }),
      );
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-1">Search</h2>
        <p className="text-sm text-muted-foreground">Find documents across your knowledge base</p>
      </div>

      {selectedFolder && (
        <div className="mb-4 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
            Folder: {selectedFolder.path}
          </span>
          <button
            onClick={async () => {
              selectFolder(null);
              setGraphResults([]);
              // Clear folder and immediately search without stale closure
              if (query.trim()) {
                try { await search(query, mode); } catch { /* ignore */ }
              }
            }}
            className="rounded-full bg-muted/40 px-2 py-1 hover:bg-muted/60"
          >
            清除文件夹
          </button>
        </div>
      )}

      {/* Search Bar with History */}
      <div className="relative mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <Input
              type="text"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setShowHistory(e.target.value.length > 0 ? false : true);
              }}
              onFocus={() => setShowHistory(true)}
              onBlur={() => setTimeout(() => setShowHistory(false), 200)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSearch();
                if (e.key === 'Escape') setShowHistory(false);
              }}
              placeholder="搜索知识库... (⌘K)"
              autoFocus
              className="pl-10 h-10 rounded-xl bg-muted/30 border-border/50 focus:dark:bg-background focus:bg-white"
            />
          </div>
          <Select value={mode} onValueChange={(v) => setMode(v as SearchMode)}>
            <SelectTrigger className="w-28 h-10 rounded-xl border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hybrid">Hybrid</SelectItem>
              <SelectItem value="lex">Lexical</SelectItem>
              <SelectItem value="sem">Semantic</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => handleSearch()} disabled={loading} className="h-10 px-5 rounded-xl">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {/* Search History Dropdown */}
        {showHistory && searchHistory.length > 0 && !query && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border/50 rounded-xl shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                Recent searches
              </div>
              <button
                onClick={() => { clearSearchHistory(); setSearchHistory([]); }}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="py-1 max-h-48 overflow-y-auto">
              {searchHistory.map((q, i) => (
                <button
                  key={i}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setQuery(q);
                    setShowHistory(false);
                    handleSearch(q);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/40 transition-colors"
                >
                  <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{q}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Filters Row */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* Time Filter */}
        <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
          <SelectTrigger className="w-28 h-9 rounded-lg border-border/50 text-xs">
            <Calendar className="h-3 w-3 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="year">This year</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-32 h-9 rounded-lg border-border/50 text-xs">
            <ArrowUpDown className="h-3 w-3 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">Relevance</SelectItem>
            <SelectItem value="time">Most recent</SelectItem>
          </SelectContent>
        </Select>

        {/* Graph Pattern Filter */}
        <div className="relative flex-1 min-w-[200px]">
          <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <Input
            type="text"
            value={graphPattern}
            onChange={e => setGraphPattern(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="实体过滤 (如: Person:Alice)..."
            className="pl-10 h-9 rounded-lg bg-muted/20 border-border/30 text-xs"
          />
        </div>
        {graphPattern && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setGraphPattern(''); handleSearch(); }}
            className="h-9 px-2 rounded-lg text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Results count */}
      {(filteredResults.length > 0 || query) && !loading && (
        <div className="text-[11px] text-muted-foreground mb-3 flex items-center gap-2">
          <Filter className="h-3 w-3" />
          <span>
            {filteredResults.length} {filteredResults.length === 1 ? 'result' : 'results'}
            {query && ` for "${query}"`}
            {tagFilter && ` tagged #${tagFilter}`}
            {timeFilter !== 'all' && ` in ${timeFilter}`}
          </span>
        </div>
      )}

      {/* Tag filter chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {tagFilter && (
            <button
              onClick={() => setTagFilter(null)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors cursor-pointer"
            >
              <X className="h-3 w-3" /> Clear filter
            </button>
          )}
          {tags.slice(0, 15).map(tag => (
            <button
              key={tag.name}
              onClick={() => setTagFilter(tagFilter === tag.name ? null : tag.name)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors cursor-pointer ${
                tagFilter === tag.name
                  ? 'bg-primary/10 text-primary font-medium ring-1 ring-primary/20'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'
              }`}
            >
              <Hash className="h-2.5 w-2.5" />
              {tag.name}
              <span className="opacity-50">{tag.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <div className="space-y-2">
        {/* Batch actions bar */}
        {filteredResults.length > 0 && (
          <div className="flex items-center gap-3 py-2 px-1">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {selectedIds.size === filteredResults.length ? (
                <CheckSquare className="h-4 w-4 text-primary" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {selectedIds.size > 0
                ? `${selectedIds.size} selected`
                : 'Select all'}
            </button>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <div className="flex items-center gap-1">
                  <Input
                    value={batchTag}
                    onChange={e => setBatchTag(e.target.value)}
                    placeholder="添加标签..."
                    className="h-7 w-32 text-xs rounded-md"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBatchTag}
                    disabled={batchLoading || !batchTag.trim()}
                    className="h-7 text-xs gap-1"
                  >
                    <Tag className="h-3 w-3" />
                    Tag
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBatchExport}
                  className="h-7 text-xs gap-1"
                >
                  <Download className="h-3 w-3" />
                  Export
                </Button>
              </div>
            )}
          </div>
        )}
        {filteredResults.map((hit, i) => (
          <SearchResultCard
            key={hit.id}
            hit={hit}
            rank={i + 1}
            selected={selectedIds.has(hit.id)}
            onClick={() => handleOpenResult(hit)}
            onToggleSelect={() => toggleSelect(hit.id)}
          />
        ))}
        {filteredResults.length === 0 && query && !loading && (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
              <Search className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-muted-foreground mb-1">No results for "{query}"</p>
            <p className="text-xs text-muted-foreground/60">Try different keywords or search mode</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SearchResultCard({ hit, rank, selected, onClick, onToggleSelect }: {
  hit: SearchHit; rank: number; selected: boolean; onClick: () => void; onToggleSelect: () => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewPos, setPreviewPos] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-clawkb-doc', hit.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    hoverTimeoutRef.current = setTimeout(() => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        setPreviewPos({ x: rect.right + 8, y: rect.top });
        setShowPreview(true);
      }
    }, 400); // 400ms delay before showing preview
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setShowPreview(false);
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={cardRef}
        draggable
        onDragStart={handleDragStart}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`w-full rounded-xl border p-4 transition-colors group cursor-grab active:cursor-grabbing ${
          selected
            ? 'bg-primary/5 border-primary/30'
            : 'bg-card border-border/50 hover:bg-muted/20 hover:border-border'
        }`}
      >
        <div className="flex items-start gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
            className="mt-0.5 shrink-0 cursor-pointer"
          >
            {selected
              ? <CheckSquare className="h-4 w-4 text-primary" />
              : <Square className="h-4 w-4 text-muted-foreground/40 hover:text-muted-foreground" />
            }
          </button>
          <button onClick={onClick} className="flex-1 text-left cursor-pointer">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="text-sm font-medium leading-tight group-hover:text-primary transition-colors">{hit.title || '(untitled)'}</h3>
              <span className="text-[11px] text-muted-foreground/60 whitespace-nowrap tabular-nums">
                #{rank} · {hit.score.toFixed(2)}
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed mb-3 line-clamp-2">{hit.content}</p>
            {hit.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {hit.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                    <Hash className="h-2.5 w-2.5" />{tag}
                  </span>
                ))}
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Hover Preview Popup */}
      {showPreview && (
        <div
          className="fixed z-50 bg-card border border-border/70 rounded-xl shadow-xl p-4 max-w-md max-h-80 overflow-hidden"
          style={{
            left: `${previewPos.x}px`,
            top: `${previewPos.y}px`,
          }}
        >
          <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
            <span>预览</span>
            <span className="text-[10px] opacity-50">· 悬停查看</span>
          </div>
          <h4 className="text-sm font-semibold mb-2 line-clamp-1">{hit.title || '(untitled)'}</h4>
          <div className="text-[13px] text-muted-foreground leading-relaxed max-h-48 overflow-y-auto">
            {hit.content || '无内容'}
          </div>
          {hit.tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mt-3 pt-3 border-t border-border/30">
              {hit.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                  <Hash className="h-2 w-2" />{tag}
                </span>
              ))}
            </div>
          )}
          <div className="text-[10px] text-muted-foreground/50 mt-3 pt-2 border-t border-border/30 flex items-center justify-between">
            <span>{hit.score.toFixed(2)} 相关度</span>
            <span>{hit.created_at ? new Date(hit.created_at).toLocaleDateString() : '未知日期'}</span>
          </div>
        </div>
      )}
    </>
  );
}

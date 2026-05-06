import { useState, useCallback } from 'react';
import { Search, Loader2, Hash, X, CheckSquare, Square, Tag, Download, Filter, GitBranch } from 'lucide-react';
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

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('hybrid');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [graphPattern, setGraphPattern] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchTag, setBatchTag] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [graphResults, setGraphResults] = useState<SearchHit[]>([]);
  const { results, loading, search } = useSearch();
  const { tags } = useTags();
  const setPage = useKbStore(s => s.setPage);
  const { selectedFolder, selectFolder } = useFolderStore();
  const setActiveDocumentsView = useWorkspaceStore(s => s.setActiveDocumentsView);
  const selectDocument = useDocumentWorkspaceStore(s => s.selectDocument);
  const seedDraftFromDocument = useDocumentWorkspaceStore(s => s.seedDraftFromDocument);
  const setActiveTab = useDocumentWorkspaceStore(s => s.setActiveTab);
  const { toast } = useToast();

  const handleSearch = useCallback(async () => {
    setSelectedIds(new Set());
    try {
      if (!query.trim() && !selectedFolder) {
        toast(userInputError('Enter a search query, or switch to a folder-scoped search before running this action.'));
        return;
      }

      if (selectedFolder) {
        const hits = await api.searchInFolder(selectedFolder.id, query || '*', 20, mode);
        setGraphResults(hits);
        return;
      }
      // Use graph-enhanced search if pattern is provided
      if (graphPattern.trim()) {
        const hits = await api.searchWithGraph(query, graphPattern, 20, mode);
        setGraphResults(hits);
      } else {
        await search(query, mode);
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
  }, [query, mode, search, graphPattern]);

  const displayResults = graphResults.length > 0 ? graphResults : results;
  const filteredResults = tagFilter
    ? displayResults.filter(h => h.tags.includes(tagFilter))
    : displayResults;

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
            onClick={() => {
              selectFolder(null);
              void handleSearch();
            }}
            className="rounded-full bg-muted/40 px-2 py-1 hover:bg-muted/60"
          >
            Clear folder
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <Input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search your knowledge base..."
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
        <Button onClick={handleSearch} disabled={loading} className="h-10 px-5 rounded-xl">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {/* Graph Pattern Filter */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <GitBranch className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <Input
            type="text"
            value={graphPattern}
            onChange={e => setGraphPattern(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Filter by entity (e.g., Person:Alice, Project:memvid)..."
            className="pl-10 h-9 rounded-lg bg-muted/20 border-border/30 text-[13px]"
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
      {graphPattern && (
        <div className="text-[11px] text-muted-foreground mb-4 flex items-center gap-1">
          <Filter className="h-3 w-3" />
          <span>Graph-filtered search: results related to entities matching "{graphPattern}"</span>
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
                    placeholder="Add tags..."
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
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-clawkb-doc', hit.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
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
  );
}

import { useState, useCallback, useMemo } from 'react';
import { Hash, Tag as TagIcon, Search, FolderOpen, X } from 'lucide-react';
import { useSearch } from '@/hooks';
import { useTags } from '@/hooks';
import { useKbStore } from '@/store/kb-store';
import { Input } from '@/components/ui/input';

type SortMode = 'count' | 'alpha' | 'recent';

export function TagsPage() {
  const { tags, loading } = useTags();
  const { results, search } = useSearch();
  const openDocument = useKbStore(s => s.openDocument);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('count');
  const [tagFilter, setTagFilter] = useState('');

  const searchByTag = useCallback(async (tag: string) => {
    setSelectedTag(tag);
    await search(tag, 'hybrid', 20);
  }, [search]);

  const filteredResults = selectedTag
    ? results.filter(h => h.tags.includes(selectedTag))
    : [];

  // Sort and filter tags
  const sortedTags = useMemo(() => {
    let filtered = tagFilter
      ? tags.filter(t => t.name.toLowerCase().includes(tagFilter.toLowerCase()))
      : tags;

    switch (sortMode) {
      case 'alpha':
        return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
      case 'count':
        return [...filtered].sort((a, b) => b.count - a.count);
      default:
        return filtered;
    }
  }, [tags, sortMode, tagFilter]);

  const maxCount = tags.length > 0 ? Math.max(...tags.map(t => t.count)) : 1;
  const totalDocs = tags.reduce((sum, t) => sum + t.count, 0);
  const uniqueTags = tags.length;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-1">Tags</h2>
            <p className="text-sm text-muted-foreground">Browse and filter documents by tags</p>
          </div>
          {/* Stats badges */}
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-lg font-semibold">{uniqueTags}</div>
              <div className="text-[10px] text-muted-foreground">Tags</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <div className="text-lg font-semibold">{totalDocs}</div>
              <div className="text-[10px] text-muted-foreground">Tagged docs</div>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar: search + sort */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter tags..."
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
            className="h-8 text-xs pl-8 bg-muted/30 border-0"
          />
          {tagFilter && (
            <button onClick={() => setTagFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <div className="flex items-center bg-muted/30 rounded-md p-0.5">
          {(['count', 'alpha'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={`px-2.5 py-1 text-[11px] rounded transition-colors cursor-pointer ${
                sortMode === mode ? 'bg-background text-foreground font-medium shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {mode === 'count' ? 'By Count' : 'A-Z'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-wrap gap-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-7 w-16 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : tags.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
            <TagIcon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-muted-foreground mb-1">No tags found</p>
          <p className="text-xs text-muted-foreground/60">Add notes with tags to see them here</p>
        </div>
      ) : (
        <>
          {/* Tag Cloud */}
          <div className="flex flex-wrap gap-2 mb-8">
            {sortedTags.map(tag => {
              const scale = 0.85 + (tag.count / maxCount) * 0.35;
              const isActive = selectedTag === tag.name;
              return (
                <button
                  key={tag.name}
                  onClick={() => searchByTag(tag.name)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium ring-1 ring-primary/20'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  }`}
                  style={{ fontSize: `${scale}rem` }}
                >
                  <Hash className="h-3 w-3" />
                  {tag.name}
                  <span className="opacity-50 text-[11px] ml-0.5">{tag.count}</span>
                </button>
              );
            })}
          </div>

          {/* Folder-style tag groups (top tags by count) */}
          {!selectedTag && sortedTags.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <FolderOpen className="h-3.5 w-3.5" />
                Tag Folders
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {sortedTags.slice(0, 12).map(tag => (
                  <button
                    key={tag.name}
                    onClick={() => searchByTag(tag.name)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border/50 hover:border-border hover:bg-muted/20 transition-colors text-left cursor-pointer"
                  >
                    <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium truncate">{tag.name}</div>
                      <div className="text-[11px] text-muted-foreground">{tag.count} doc{tag.count !== 1 ? 's' : ''}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results for selected tag */}
          {selectedTag && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Documents tagged #{selectedTag}
              </h3>
              <div className="space-y-1.5">
                {filteredResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No documents found</p>
                ) : (
                  filteredResults.map(hit => (
                    <button
                      key={hit.id}
                      onClick={() => openDocument(hit)}
                      className="w-full text-left rounded-xl bg-card border border-border/50 p-4 hover:bg-muted/20 hover:border-border transition-colors cursor-pointer group"
                    >
                      <div className="text-[13px] font-medium mb-1 group-hover:text-primary transition-colors">{hit.title || '(untitled)'}</div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2 leading-relaxed">{hit.content}</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {hit.tags.map(t => (
                          <span key={t} className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md ${t === selectedTag ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'}`}>
                            <Hash className="h-2.5 w-2.5" />{t}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

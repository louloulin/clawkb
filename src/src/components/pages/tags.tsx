import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Hash, Tag as TagIcon, Search, FolderOpen, X, Edit3, Trash2, GitMerge, MoreHorizontal } from 'lucide-react';
import { useSearch } from '@/hooks';
import { useTags } from '@/hooks';
import { useKbStore } from '@/store/kb-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/api';
import { useToast } from '@/hooks/use-toast';

type SortMode = 'count' | 'alpha' | 'recent';

interface TagMenuState {
  tag: string;
  x: number;
  y: number;
}

interface RenameModalState {
  open: boolean;
  oldTag: string;
  newTag: string;
}

interface MergeModalState {
  open: boolean;
  sourceTag: string;
  destTag: string;
}

export function TagsPage() {
  const { tags, loading, refresh } = useTags();
  const { results, search } = useSearch();
  const openDocument = useKbStore(s => s.openDocument);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('count');
  const [tagFilter, setTagFilter] = useState('');
  const [tagMenu, setTagMenu] = useState<TagMenuState | null>(null);
  const [renameModal, setRenameModal] = useState<RenameModalState>({ open: false, oldTag: '', newTag: '' });
  const [mergeModal, setMergeModal] = useState<MergeModalState>({ open: false, sourceTag: '', destTag: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; tag: string }>({ open: false, tag: '' });
  const [manageMode, setManageMode] = useState(false);
  const [, setManagingTag] = useState<string | null>(null);
  const [opLoading, setOpLoading] = useState(false);
  const { toast } = useToast();
  const menuRef = useRef<HTMLDivElement>(null);

  const searchByTag = useCallback(async (tag: string) => {
    setSelectedTag(tag);
    await search(tag, 'hybrid', 20);
  }, [search]);

  const filteredResults = selectedTag
    ? results.filter(h => h.tags.includes(selectedTag))
    : [];

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

  // Close context menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setTagMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleTagRightClick = (e: React.MouseEvent, tagName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setTagMenu({ tag: tagName, x: e.clientX, y: e.clientY });
  };

  const handleRename = useCallback(async () => {
    if (!renameModal.oldTag.trim() || !renameModal.newTag.trim()) return;
    if (renameModal.oldTag === renameModal.newTag) {
      setRenameModal({ open: false, oldTag: '', newTag: '' });
      return;
    }
    setOpLoading(true);
    try {
      const result = await api.renameTag(renameModal.oldTag.trim(), renameModal.newTag.trim());
      toast({ title: `Renamed "${renameModal.oldTag}" → "${renameModal.newTag}"`, description: `${result.updated} documents updated` });
      setRenameModal({ open: false, oldTag: '', newTag: '' });
      setTagMenu(null);
      await refresh();
    } catch (e) {
      toast({ title: 'Rename failed', description: String(e), variant: 'destructive' });
    } finally {
      setOpLoading(false);
    }
  }, [renameModal, toast, refresh]);

  const handleMerge = useCallback(async () => {
    if (!mergeModal.sourceTag.trim() || !mergeModal.destTag.trim()) return;
    if (mergeModal.sourceTag === mergeModal.destTag) {
      setMergeModal({ open: false, sourceTag: '', destTag: '' });
      return;
    }
    setOpLoading(true);
    try {
      const result = await api.mergeTag(mergeModal.sourceTag.trim(), mergeModal.destTag.trim());
      toast({ title: `Merged "${mergeModal.sourceTag}" → "${mergeModal.destTag}"`, description: `${result.updated} documents updated` });
      setMergeModal({ open: false, sourceTag: '', destTag: '' });
      setTagMenu(null);
      await refresh();
    } catch (e) {
      toast({ title: 'Merge failed', description: String(e), variant: 'destructive' });
    } finally {
      setOpLoading(false);
    }
  }, [mergeModal, toast, refresh]);

  const handleDelete = useCallback(async () => {
    if (!deleteConfirm.tag.trim()) return;
    setOpLoading(true);
    try {
      const result = await api.deleteTag(deleteConfirm.tag.trim());
      toast({ title: `Deleted tag "${deleteConfirm.tag}"`, description: `Removed from ${result.updated} documents` });
      setDeleteConfirm({ open: false, tag: '' });
      setTagMenu(null);
      if (selectedTag === deleteConfirm.tag) setSelectedTag(null);
      await refresh();
    } catch (e) {
      toast({ title: 'Delete failed', description: String(e), variant: 'destructive' });
    } finally {
      setOpLoading(false);
    }
  }, [deleteConfirm, selectedTag, toast, refresh]);

  const openRenameModal = (tag: string) => {
    setRenameModal({ open: true, oldTag: tag, newTag: tag });
    setTagMenu(null);
  };

  const openMergeModal = (tag: string) => {
    setMergeModal({ open: true, sourceTag: tag, destTag: '' });
    setTagMenu(null);
  };

  const openDeleteConfirm = (tag: string) => {
    setDeleteConfirm({ open: true, tag });
    setTagMenu(null);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-1">Tags</h2>
            <p className="text-sm text-muted-foreground">Browse and manage document tags</p>
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
            <div className="w-px h-8 bg-border" />
            <Button
              variant={manageMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setManageMode(!manageMode); setManagingTag(null); }}
              className="h-8 text-[12px] gap-1.5"
            >
              <Edit3 className="h-3 w-3" />
              {manageMode ? 'Done' : 'Manage'}
            </Button>
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
                sortMode === mode ? 'dark:bg-background bg-white text-foreground font-medium shadow-sm' : 'text-muted-foreground'
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
                  onContextMenu={e => handleTagRightClick(e, tag.name)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] transition-colors cursor-pointer group ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium ring-1 ring-primary/20'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  }`}
                  style={{ fontSize: `${scale}rem` }}
                >
                  <Hash className="h-3 w-3" />
                  {tag.name}
                  <span className="opacity-50 text-[11px] ml-0.5">{tag.count}</span>
                  {manageMode && (
                    <button
                      onClick={e => { e.stopPropagation(); setManagingTag(tag.name); openRenameModal(tag.name); }}
                      className="ml-1 opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity"
                      title="Manage tag"
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </button>
                  )}
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
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Documents tagged #{selectedTag}
                </h3>
                {manageMode && (
                  <Button size="sm" variant="outline" className="h-6 text-[11px] gap-1" onClick={() => openMergeModal(selectedTag)}>
                    <GitMerge className="h-3 w-3" /> Merge
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-6 text-[11px] ml-auto" onClick={() => setSelectedTag(null)}>
                  <X className="h-3 w-3 mr-1" /> Clear
                </Button>
              </div>
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

      {/* Context Menu */}
      {tagMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-popover border border-border rounded-xl shadow-xl py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
          style={{ left: tagMenu.x, top: tagMenu.y }}
        >
          <button
            onClick={() => openRenameModal(tagMenu.tag)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
            Rename tag
          </button>
          <button
            onClick={() => openMergeModal(tagMenu.tag)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <GitMerge className="h-3.5 w-3.5 text-muted-foreground" />
            Merge into...
          </button>
          <div className="h-px bg-border my-1" />
          <button
            onClick={() => openDeleteConfirm(tagMenu.tag)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete tag
          </button>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="dark:bg-background bg-white border border-border rounded-2xl shadow-2xl w-[360px] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Rename Tag</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Current name</label>
                <Input value={renameModal.oldTag} disabled className="h-8 text-xs bg-muted/40" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">New name</label>
                <Input
                  value={renameModal.newTag}
                  onChange={e => setRenameModal(m => ({ ...m, newTag: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleRename()}
                  className="h-8 text-xs"
                  placeholder="Enter new tag name..."
                  autoFocus
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              This will rename the tag across all {tags.find(t => t.name === renameModal.oldTag)?.count ?? 0} documents.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="h-8 text-[12px]" onClick={() => setRenameModal({ open: false, oldTag: '', newTag: '' })}>
                Cancel
              </Button>
              <Button size="sm" className="h-8 text-[12px]" onClick={handleRename} disabled={opLoading || !renameModal.newTag.trim() || renameModal.oldTag === renameModal.newTag}>
                {opLoading ? 'Renaming...' : 'Rename'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {mergeModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="dark:bg-background bg-white border border-border rounded-2xl shadow-2xl w-[360px] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <GitMerge className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Merge Tag</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Source tag (will be removed)</label>
                <Input value={mergeModal.sourceTag} disabled className="h-8 text-xs bg-muted/40" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Destination tag</label>
                <select
                  value={mergeModal.destTag}
                  onChange={e => setMergeModal(m => ({ ...m, destTag: e.target.value }))}
                  className="w-full h-8 text-xs px-2 rounded-md border border-input dark:bg-background bg-white"
                >
                  <option value="">Select destination tag...</option>
                  {tags.filter(t => t.name !== mergeModal.sourceTag).map(t => (
                    <option key={t.name} value={t.name}>{t.name} ({t.count})</option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Documents with both tags will have the source tag removed.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="h-8 text-[12px]" onClick={() => setMergeModal({ open: false, sourceTag: '', destTag: '' })}>
                Cancel
              </Button>
              <Button size="sm" className="h-8 text-[12px]" onClick={handleMerge} disabled={opLoading || !mergeModal.destTag || mergeModal.sourceTag === mergeModal.destTag}>
                {opLoading ? 'Merging...' : 'Merge'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="dark:bg-background bg-white border border-border rounded-2xl shadow-2xl w-[360px] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              <h3 className="text-sm font-semibold">Delete Tag</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete the tag <strong>"{deleteConfirm.tag}"</strong>? This will remove it from <strong>{tags.find(t => t.name === deleteConfirm.tag)?.count ?? 0}</strong> documents. The documents themselves will not be deleted.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="h-8 text-[12px]" onClick={() => setDeleteConfirm({ open: false, tag: '' })}>
                Cancel
              </Button>
              <Button size="sm" variant="destructive" className="h-8 text-[12px]" onClick={handleDelete} disabled={opLoading}>
                {opLoading ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

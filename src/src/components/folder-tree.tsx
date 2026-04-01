import { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreHorizontal,
  Trash2,
  Edit3,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFolderStore, buildFolderTree, type FolderTreeNode } from '@/store/folder-store';
import { useKbStore } from '@/store/kb-store';

interface FolderTreeProps {
  onFolderSelect?: (folderId: string | null) => void;
}

export function FolderTree({ onFolderSelect }: FolderTreeProps) {
  const { folders, selectedFolder, loadFolders, createFolder, selectFolder, toggleExpand } = useFolderStore();
  const setPage = useKbStore(s => s.setPage);

  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ folderId: string; x: number; y: number } | null>(null);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const tree = buildFolderTree(folders);

  const handleCreateFolder = async (parentId: string | null = null) => {
    if (!newFolderName.trim()) return;
    await createFolder(newFolderName.trim(), parentId);
    setNewFolderName('');
    setIsCreating(false);
    setCreatingParentId(null);
  };

  const handleContextMenu = (e: React.MouseEvent, folderId: string) => {
    e.preventDefault();
    setContextMenu({ folderId, x: e.clientX, y: e.clientY });
  };

  const handleSearchInFolder = (folderId: string) => {
    selectFolder(folders.find(f => f.id === folderId) || null);
    setPage('search');
    onFolderSelect?.(folderId);
  };

  return (
    <div className="py-2">
      {/* Header */}
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
          Folders
        </span>
        <button
          onClick={() => setIsCreating(true)}
          className="p-1 rounded hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Root level creation */}
      {isCreating && creatingParentId === null && (
        <div className="px-2 mb-2">
          <div className="flex items-center gap-1">
            <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateFolder(null);
                if (e.key === 'Escape') { setIsCreating(false); setNewFolderName(''); }
              }}
              onBlur={() => { if (!newFolderName.trim()) { setIsCreating(false); } }}
              placeholder="Folder name..."
              className="h-7 text-[12px] rounded-md"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Folder tree */}
      <div className="space-y-0.5">
        {tree.length === 0 && !isCreating && (
          <div className="px-2 py-4 text-center">
            <p className="text-[11px] text-muted-foreground/60">No folders yet</p>
            <button
              onClick={() => setIsCreating(true)}
              className="text-[11px] text-primary hover:underline mt-1 cursor-pointer"
            >
              Create one
            </button>
          </div>
        )}

        {tree.map(node => (
          <FolderNode
            key={node.id}
            node={node}
            selectedFolder={selectedFolder}
            onSelect={(folder) => {
              selectFolder(folder);
              onFolderSelect?.(folder?.id || null);
            }}
            onToggleExpand={(id) => toggleExpand(id)}
            onContextMenu={handleContextMenu}
            onCreateChild={(parentId) => {
              setCreatingParentId(parentId);
              setIsCreating(true);
            }}
            onSearchInFolder={handleSearchInFolder}
          />
        ))}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                handleSearchInFolder(contextMenu.folderId);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-muted/40 transition-colors cursor-pointer"
            >
              <Search className="h-3.5 w-3.5" />
              Search in folder
            </button>
            <button
              onClick={() => {
                setCreatingParentId(contextMenu.folderId);
                setIsCreating(true);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-muted/40 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              New subfolder
            </button>
            <div className="h-px bg-border my-1" />
            <button
              onClick={() => setContextMenu(null)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

interface FolderNodeProps {
  node: FolderTreeNode;
  selectedFolder: { id: string } | null;
  onSelect: (folder: FolderTreeNode | null) => void;
  onToggleExpand: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onCreateChild: (parentId: string) => void;
  onSearchInFolder: (id: string) => void;
}

function FolderNode({
  node,
  selectedFolder,
  onSelect,
  onToggleExpand,
  onContextMenu,
  onCreateChild,
  onSearchInFolder,
}: FolderNodeProps) {
  const isSelected = selectedFolder?.id === node.id;
  const hasChildren = node.children.length > 0;
  const [isCreatingChild, setIsCreatingChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const { createFolder } = useFolderStore();

  const handleCreateChild = async () => {
    if (!newChildName.trim()) return;
    await createFolder(newChildName.trim(), node.id);
    setNewChildName('');
    setIsCreatingChild(false);
    onToggleExpand(node.id);
  };

  return (
    <div>
      {/* Folder row */}
      <div
        className={`group flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-colors ${
          isSelected
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
        }`}
        style={{ paddingLeft: `${node.depth * 12 + 8}px` }}
        onClick={() => onSelect(node)}
        onContextMenu={(e) => onContextMenu(e, node.id)}
      >
        {/* Expand/collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggleExpand(node.id);
          }}
          className={`shrink-0 p-0.5 rounded ${hasChildren ? 'hover:bg-muted/60' : 'opacity-0'}`}
        >
          {node.isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>

        {/* Folder icon */}
        {node.isExpanded && hasChildren ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
        )}

        {/* Folder name */}
        <span className="flex-1 truncate text-[12px] font-medium">{node.name}</span>

        {/* Doc count */}
        {node.docCount > 0 && (
          <span className="text-[10px] text-muted-foreground/60">{node.docCount}</span>
        )}

        {/* Action buttons (visible on hover) */}
        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSearchInFolder(node.id);
            }}
            className="p-1 rounded hover:bg-muted/60"
            title="Search in folder"
          >
            <Search className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateChild(node.id);
            }}
            className="p-1 rounded hover:bg-muted/60"
            title="New subfolder"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Children */}
      {node.isExpanded && (
        <div>
          {node.children.map(child => (
            <FolderNode
              key={child.id}
              node={child}
              selectedFolder={selectedFolder}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onContextMenu={onContextMenu}
              onCreateChild={onCreateChild}
              onSearchInFolder={onSearchInFolder}
            />
          ))}

          {/* Create child folder */}
          {isCreatingChild && (
            <div style={{ paddingLeft: `${(node.depth + 1) * 12 + 8}px` }} className="px-2 py-1">
              <div className="flex items-center gap-1">
                <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <Input
                  value={newChildName}
                  onChange={e => setNewChildName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateChild();
                    if (e.key === 'Escape') { setIsCreatingChild(false); setNewChildName(''); }
                  }}
                  onBlur={() => { if (!newChildName.trim()) setIsCreatingChild(false); }}
                  placeholder="Folder name..."
                  className="h-6 text-[11px] rounded-md"
                  autoFocus
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

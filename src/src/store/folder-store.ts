import { create } from 'zustand';
import { api } from '@/api';

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  createdAt: number;
  docCount: number;
  isExpanded?: boolean;
}

interface FolderState {
  folders: Folder[];
  selectedFolder: Folder | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadFolders: () => Promise<void>;
  createFolder: (name: string, parentId?: string | null) => Promise<Folder>;
  renameFolder: (folderId: string, newName: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  selectFolder: (folder: Folder | null) => void;
  toggleExpand: (folderId: string) => void;
  moveDocument: (docId: string, folderId: string | null) => Promise<void>;
  getChildFolders: (parentId: string | null) => Folder[];
  getFolderPath: (folderId: string) => Folder[];
}

const STORAGE_KEY = 'clawkb-folders';

function loadFromStorage(): Folder[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return [];
}

function saveToStorage(folders: Folder[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
  } catch {}
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folders: loadFromStorage(),
  selectedFolder: null,
  isLoading: false,
  error: null,

  loadFolders: async () => {
    set({ isLoading: true, error: null });
    try {
      // Try to load from backend if available
      if (typeof api !== 'undefined') {
        const folders = await api.listFolders();
        set({ folders, isLoading: false });
        saveToStorage(folders);
      } else {
        // Fall back to localStorage
        const folders = loadFromStorage();
        set({ folders, isLoading: false });
      }
    } catch (e) {
      // Fall back to localStorage
      const folders = loadFromStorage();
      set({ folders, isLoading: false, error: null });
    }
  },

  createFolder: async (name: string, parentId: string | null = null) => {
    const id = `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const parent = parentId ? get().folders.find(f => f.id === parentId) : null;
    const path = parent ? `${parent.path}/${name}` : `/${name}`;

    const folder: Folder = {
      id,
      name,
      parentId,
      path,
      createdAt: Date.now(),
      docCount: 0,
      isExpanded: false,
    };

    // Update local state
    set(state => {
      const newFolders = [...state.folders, folder];
      saveToStorage(newFolders);
      return { folders: newFolders };
    });

    // Try to sync with backend
    try {
      await api.createFolder(name, parentId);
    } catch {
      // Ignore backend errors for now
    }

    return folder;
  },

  renameFolder: async (folderId: string, newName: string) => {
    set(state => {
      const newFolders = state.folders.map(f => {
        if (f.id === folderId) {
          const parent = f.parentId ? state.folders.find(p => p.id === f.parentId) : null;
          return {
            ...f,
            name: newName,
            path: parent ? `${parent.path}/${newName}` : `/${newName}`,
          };
        }
        return f;
      });
      saveToStorage(newFolders);
      return { folders: newFolders };
    });

    try {
      await api.renameFolder(folderId, newName);
    } catch {}
  },

  deleteFolder: async (folderId: string) => {
    set(state => {
      // Also delete child folders
      const toDelete = new Set<string>([folderId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const f of state.folders) {
          if (f.parentId && toDelete.has(f.parentId) && !toDelete.has(f.id)) {
            toDelete.add(f.id);
            changed = true;
          }
        }
      }

      const newFolders = state.folders.filter(f => !toDelete.has(f.id));
      const newSelected = state.selectedFolder && toDelete.has(state.selectedFolder.id) ? null : state.selectedFolder;
      saveToStorage(newFolders);
      return { folders: newFolders, selectedFolder: newSelected };
    });

    try {
      await api.deleteFolder(folderId);
    } catch {}
  },

  selectFolder: (folder: Folder | null) => {
    set({ selectedFolder: folder });
  },

  toggleExpand: (folderId: string) => {
    set(state => {
      const newFolders = state.folders.map(f =>
        f.id === folderId ? { ...f, isExpanded: !f.isExpanded } : f
      );
      return { folders: newFolders };
    });
  },

  moveDocument: async (docId: string, folderId: string | null) => {
    // Update local folder's doc count
    set(state => {
      const newFolders = state.folders.map(f => {
        if (f.id === folderId) {
          return { ...f, docCount: f.docCount + 1 };
        }
        return f;
      });
      saveToStorage(newFolders);
      return { folders: newFolders };
    });

    try {
      await api.moveDocument(docId, folderId);
    } catch {}
  },

  getChildFolders: (parentId: string | null) => {
    return get().folders.filter(f => f.parentId === parentId);
  },

  getFolderPath: (folderId: string) => {
    const folders = get().folders;
    const result: Folder[] = [];
    let current = folders.find(f => f.id === folderId);

    while (current) {
      result.unshift(current);
      current = current.parentId ? folders.find(f => f.id === current!.parentId) : undefined;
    }

    return result;
  },
}));

// Helper to get folder tree structure
export function buildFolderTree(folders: Folder[]): FolderTreeNode[] {
  const map = new Map<string, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];

  // First pass: create nodes
  for (const folder of folders) {
    map.set(folder.id, {
      ...folder,
      children: [],
      depth: 0,
    });
  }

  // Second pass: build tree
  for (const folder of folders) {
    const node = map.get(folder.id)!;
    if (folder.parentId && map.has(folder.parentId)) {
      const parent = map.get(folder.parentId)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort by name
  const sortNodes = (nodes: FolderTreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };
  sortNodes(roots);

  return roots;
}

export interface FolderTreeNode extends Folder {
  children: FolderTreeNode[];
  depth: number;
}

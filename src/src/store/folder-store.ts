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

export const useFolderStore = create<FolderState>((set, get) => ({
  folders: [],
  selectedFolder: null,
  isLoading: false,
  error: null,

  loadFolders: async () => {
    set({ isLoading: true, error: null });
    try {
      const existingExpansion = new Map(get().folders.map((folder) => [folder.id, folder.isExpanded ?? false]));
      const folders = await api.listFolders();
      set({
        folders: folders.map((folder) => ({
          ...folder,
          isExpanded: existingExpansion.get(folder.id) ?? false,
        })),
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false, error: String(error) });
    }
  },

  createFolder: async (name, parentId = null) => {
    try {
      const folder = await api.createFolder(name, parentId);
      await get().loadFolders();
      return { ...folder, isExpanded: false };
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  renameFolder: async (folderId, newName) => {
    await api.renameFolder(folderId, newName);
    await get().loadFolders();
  },

  deleteFolder: async (folderId) => {
    await api.deleteFolder(folderId);
    const selected = get().selectedFolder;
    await get().loadFolders();
    if (selected?.id === folderId) {
      set({ selectedFolder: null });
    }
  },

  selectFolder: (folder) => set({ selectedFolder: folder }),

  toggleExpand: (folderId) =>
    set((state) => ({
      folders: state.folders.map((folder) =>
        folder.id === folderId ? { ...folder, isExpanded: !folder.isExpanded } : folder,
      ),
    })),

  moveDocument: async (docId, folderId) => {
    try {
      await api.moveDocument(docId, folderId);
      await get().loadFolders();
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  getChildFolders: (parentId) => get().folders.filter((folder) => folder.parentId === parentId),

  getFolderPath: (folderId) => {
    const folders = get().folders;
    const result: Folder[] = [];
    let current = folders.find((folder) => folder.id === folderId);

    while (current) {
      result.unshift(current);
      current = current.parentId ? folders.find((folder) => folder.id === current!.parentId) : undefined;
    }

    return result;
  },
}));

export function buildFolderTree(folders: Folder[]): FolderTreeNode[] {
  const map = new Map<string, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];

  for (const folder of folders) {
    map.set(folder.id, {
      ...folder,
      children: [],
      depth: 0,
    });
  }

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

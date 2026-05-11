import { create } from 'zustand';
import { api } from '@/api';
import { toast } from '@/hooks/use-toast';

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  path: string;
  created_at: number;
  doc_count: number;
  isExpanded?: boolean;
}

interface FolderState {
  folders: Folder[];
  selectedFolder: Folder | null;
  isLoading: boolean;
  error: string | null;
  loadFolders: () => Promise<void>;
  createFolder: (name: string, parent_id?: string | null) => Promise<Folder>;
  renameFolder: (folderId: string, newName: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  selectFolder: (folder: Folder | null) => void;
  toggleExpand: (folderId: string) => void;
  moveDocument: (docId: string, folderId: string | null) => Promise<void>;
  getChildFolders: (parent_id: string | null) => Folder[];
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

  createFolder: async (name, parent_id = null) => {
    try {
      const folder = await api.createFolder(name, parent_id);
      await get().loadFolders();
      return { ...folder, isExpanded: false };
    } catch (e) {
      set({ error: String(e) });
      toast({
        title: '创建文件夹失败',
        description: String(e),
        variant: 'destructive',
      });
      throw e;
    }
  },

  renameFolder: async (folderId, newName) => {
    try {
      await api.renameFolder(folderId, newName);
      await get().loadFolders();
    } catch (e) {
      set({ error: String(e) });
      toast({
        title: '重命名文件夹失败',
        description: String(e),
        variant: 'destructive',
      });
      throw e;
    }
  },

  deleteFolder: async (folderId) => {
    try {
      await api.deleteFolder(folderId);
      const selected = get().selectedFolder;
      await get().loadFolders();
      if (selected?.id === folderId) {
        set({ selectedFolder: null });
      }
    } catch (e) {
      set({ error: String(e) });
      toast({
        title: '删除文件夹失败',
        description: String(e),
        variant: 'destructive',
      });
      throw e;
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
      toast({
        title: '移动文件失败',
        description: String(e),
        variant: 'destructive',
      });
      throw e;
    }
  },

  getChildFolders: (parent_id) => get().folders.filter((folder) => folder.parent_id === parent_id),

  getFolderPath: (folderId) => {
    const folders = get().folders;
    const result: Folder[] = [];
    let current = folders.find((folder) => folder.id === folderId);

    while (current) {
      result.unshift(current);
      current = current.parent_id ? folders.find((folder) => folder.id === current!.parent_id) : undefined;
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
    if (folder.parent_id && map.has(folder.parent_id)) {
      const parent = map.get(folder.parent_id)!;
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

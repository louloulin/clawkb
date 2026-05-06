import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, FileText, Settings, FolderOpen, Users, X } from 'lucide-react';
import { api } from '@/api';
import type { SearchHit } from '@/api';

interface Command {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  action: () => void;
  category: 'navigation' | 'document' | 'kb' | 'ai';
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands?: Command[];
}

export function CommandPalette({ open, onClose, commands = [] }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Default commands
  const defaultCommands: Command[] = useMemo(() => [
    { id: 'nav-home', label: '首页', sublabel: 'Workbench', icon: <FileText className="h-4 w-4" />, action: () => { window.location.hash = '#/'; onClose(); }, category: 'navigation' },
    { id: 'nav-search', label: '搜索', sublabel: '搜索笔记', icon: <Search className="h-4 w-4" />, action: () => { window.location.hash = '#/search'; onClose(); }, category: 'navigation' },
    { id: 'nav-spaces', label: '知识库管理', sublabel: '管理已打开的知识库', icon: <FolderOpen className="h-4 w-4" />, action: () => { window.location.hash = '#/spaces'; onClose(); }, category: 'kb' },
    { id: 'nav-settings', label: '设置', sublabel: '应用偏好设置', icon: <Settings className="h-4 w-4" />, action: () => { window.location.hash = '#/settings'; onClose(); }, category: 'navigation' },
    { id: 'ai-ask', label: 'AI 问答', sublabel: '向知识库提问', icon: <Users className="h-4 w-4" />, action: () => { window.location.hash = '#/'; onClose(); }, category: 'ai' },
  ], [onClose]);

  const allCommands = useMemo(() => [...defaultCommands, ...commands], [defaultCommands, commands]);

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands.slice(0, 8);
    const q = query.toLowerCase();
    return allCommands.filter(cmd =>
      cmd.label.toLowerCase().includes(q) ||
      (cmd.sublabel?.toLowerCase().includes(q) ?? false)
    ).slice(0, 8);
  }, [allCommands, query]);

  const allItems = useMemo(() => {
    const items: Array<{ type: 'command' | 'result'; label: string; sublabel?: string; icon?: React.ReactNode; action: () => void }> = [];
    for (const cmd of filteredCommands) {
      items.push({ type: 'command', label: cmd.label, sublabel: cmd.sublabel, icon: cmd.icon, action: cmd.action });
    }
    if (query.trim().length > 1) {
      for (const r of searchResults) {
        items.push({ type: 'result', label: r.title || '未命名笔记', sublabel: r.content?.slice(0, 60), action: () => { onClose(); } });
      }
    }
    return items;
  }, [filteredCommands, searchResults, query, onClose]);

  // Search KB when query is long enough
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await api.search(query, 5);
        setSearchResults(results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, allItems.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = allItems[selectedIndex];
        if (item) item.action();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, allItems, selectedIndex, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Palette */}
      <div className="relative w-full max-w-xl bg-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="搜索命令、笔记..."
            className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
          />
          {searching && <span className="text-xs text-muted-foreground animate-pulse">搜索中...</span>}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {allItems.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-8">没有找到匹配结果</div>
          ) : (
            allItems.map((item, i) => (
              <button
                key={i}
                onClick={() => { item.action(); onClose(); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                  i === selectedIndex ? 'bg-amber-300/20 text-amber-100' : 'hover:bg-white/8'
                }`}
              >
                {item.icon && <span className="text-muted-foreground shrink-0">{item.icon}</span>}
                <span className="flex-1 truncate">{item.label}</span>
                {item.sublabel && (
                  <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                    {item.sublabel}
                  </span>
                )}
                {i === selectedIndex && (
                  <span className="text-[10px] text-muted-foreground">↵</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="px-4 py-2 border-t border-white/10 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span>↑↓ 导航</span>
          <span>↵ 选中</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </div>
  );
}
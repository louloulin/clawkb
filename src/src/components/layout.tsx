import React from 'react';
import {
  BookOpen,
  LibraryBig,
  Menu,
  Monitor,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Search,
  Settings,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { getRuntimeModeInfo, isBrowserPreview } from '@/api/platform';
import { useKbStore } from '@/store/kb-store';
import { useWorkspaceStore } from '@/store/workspace-store';
import { formatBytes } from '@/lib/format';
import { DailyCalendar } from '@/components/ui/daily-calendar';
import { api } from '@/api/commands';

const navItems = [
  { id: 'home', label: '工作台', icon: Sparkles },
  { id: 'documents', label: '探索', icon: Search },
  { id: 'reader', label: '笔记', icon: BookOpen },
  { id: 'spaces', label: '知识库', icon: LibraryBig },
  { id: 'settings', label: '设置', icon: Settings },
] as const;

const pageLabels: Record<string, string> = {
  home: '工作台',
  spaces: '知识库',
  documents: '探索',
  explore: '探索',
  settings: '设置',
  dashboard: '工作台',
  search: '搜索',
  notes: '笔记',
  import: '导入',
  timeline: '时间线',
  tags: '标签',
  chat: '对话',
  graph: '图谱',
  reader: '笔记',
  editor: '编辑器',
  mindmap: '脑图',
  report: '报告',
  podcast: '播客',
  entities: '实体',
};

export function Sidebar() {
  const { currentPage, setPage, sidebarCollapsed, toggleSidebar, stats, kbPath, isKbOpen, mobileSidebarOpen, setMobileSidebarOpen } = useKbStore();
  const [dailyDates, setDailyDates] = useState<string[]>([]);

  useEffect(() => {
    if (!isKbOpen) { setDailyDates([]); return; }
    api.search('Daily Note', 50, 'lex').then(hits => {
      const dates = hits
        .map(h => h.title?.replace('Daily Note ', '').trim())
        .filter((d): d is string => /^\d{4}-\d{2}-\d{2}$/.test(d));
      setDailyDates(dates);
    }).catch(() => setDailyDates([]));
  }, [isKbOpen]);

  const handleSelectDate = useCallback((dateStr: string) => {
    const title = `Daily Note ${dateStr}`;
    void (async () => {
      try {
        const hits = await api.search(title, 1, 'lex');
        if (hits.length > 0 && hits[0].title === title) {
          useKbStore.getState().openDocument(hits[0]);
        } else {
          await api.addNote(title, `# ${dateStr}\n\n`, ['daily']);
          const newHits = await api.search(title, 1, 'lex');
          if (newHits.length > 0) useKbStore.getState().openDocument(newHits[0]);
        }
        setPage('editor');
      } catch { /* ignore */ }
    })();
  }, [setPage]);

  const handleNavClick = (id: string) => {
    setPage(id);
    setMobileSidebarOpen(false);
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <aside
        className={`${
          sidebarCollapsed ? 'w-[86px]' : 'w-[220px]'
        } kb-shell shrink-0 border-r border-border text-foreground transition-all duration-200 ease-out
        hidden md:flex md:flex-col
        fixed inset-y-0 left-0 z-50 ${mobileSidebarOpen ? '!flex flex-col' : ''}
        `}
      >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between px-4">
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="kb-chip flex h-11 w-11 items-center justify-center rounded-2xl text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <div className="text-sm font-semibold tracking-tight">ClawKB</div>
                <div className="text-[11px] tracking-[0.22em] text-muted-foreground">本地知识工作台</div>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>

        {sidebarCollapsed && (
          <div className="px-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-10 w-10 rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Mobile close button */}
        <button
          className="absolute right-3 top-4 z-10 rounded-lg p-1 text-muted-foreground hover:text-foreground md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>

        <nav className="mt-4 flex flex-col gap-1 px-2">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            // Add separator after home for visual grouping
            const showSeparator = index === 1;

            return (
              <React.Fragment key={item.id}>
                {showSeparator && !sidebarCollapsed && (
                  <div className="my-3 h-px bg-muted" />
                )}
                <button
                  onClick={() => handleNavClick(item.id)}
                  aria-label={item.label}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    isActive
                      ? 'bg-amber-200/10 text-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      isActive ? 'bg-primary/15 text-primary' : ''
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  {!sidebarCollapsed && (
                    <span className="text-sm font-medium">{item.label}</span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {!sidebarCollapsed && (
          <div className="px-3 mt-2">
            <DailyCalendar dailyDates={dailyDates} onSelectDate={handleSelectDate} />
          </div>
        )}

        <div className="mt-auto" />

        <div className="border-t border-border px-4 py-4">
          {isKbOpen && stats ? (
            <div className={`kb-panel-strong rounded-2xl p-3 ${sidebarCollapsed ? 'text-center' : ''}`}>
              <div className={`flex items-center gap-2 ${sidebarCollapsed ? 'justify-center' : ''}`}>
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                {!sidebarCollapsed && (
                  <span className="truncate text-xs font-medium text-foreground">{kbPath.split('/').pop()}</span>
                )}
              </div>
              {!sidebarCollapsed ? (
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{stats.frame_count} 篇资料</span>
                  <span>{formatBytes(stats.size_bytes)}</span>
                </div>
              ) : (
                <div className="mt-2 text-[10px] text-muted-foreground">{stats.frame_count}</div>
              )}
            </div>
          ) : (
            <div className={`kb-panel-strong rounded-2xl border-dashed p-3 text-[11px] text-muted-foreground ${sidebarCollapsed ? 'text-center' : ''}`}>
              {sidebarCollapsed ? 'KB' : '先打开本地知识库，再开始检索、阅读和沉淀笔记。'}
            </div>
          )}
        </div>
      </div>
    </aside>
    </>
  );
}

export function Header() {
  const { currentPage, darkMode, toggleDarkMode, setPage, setMobileSidebarOpen } = useKbStore();
  const { openExploreView } = useWorkspaceStore();
  const runtimeInfo = getRuntimeModeInfo();

  const handleSearchClick = () => {
    openExploreView('search');
    setPage('documents');
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        handleSearchClick();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <header className="kb-panel-strong flex h-14 shrink-0 items-center justify-between border-b border-border px-5 text-foreground">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger menu */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground md:hidden"
          onClick={() => setMobileSidebarOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <button
          onClick={handleSearchClick}
          className="kb-chip flex h-10 w-full max-w-sm items-center gap-2.5 rounded-full px-4 text-sm text-foreground/80 transition hover:bg-accent hover:text-foreground"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate">搜索你的知识库…</span>
          <kbd className="ml-auto hidden rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground sm:inline-block">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="ml-4 flex items-center gap-3">
        {isBrowserPreview() && (
          <span
            data-runtime-badge
            title={runtimeInfo.summary}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-primary"
          >
            <Monitor className="h-3 w-3" />
            {runtimeInfo.badge}
          </span>
        )}
        <span className="hidden text-sm font-medium text-foreground/80 lg:inline">{pageLabels[currentPage] ?? currentPage}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDarkMode}
          className="h-9 w-9 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}

export function MobileBottomNav() {
  const { currentPage, setPage } = useKbStore();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/92 px-2 py-2 backdrop-blur-xl md:hidden">
      <div className="flex justify-around gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] transition ${
                isActive ? 'bg-amber-200/12 text-foreground' : 'text-muted-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

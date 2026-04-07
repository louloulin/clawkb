import {
  BookOpen,
  BookOpenText,
  Compass,
  Monitor,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Search,
  Settings,
  Sparkles,
  Sun,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getRuntimeModeInfo, isBrowserPreview } from '@/api/platform';
import { useKbStore } from '@/store/kb-store';
import { FolderTree } from '@/components/folder-tree';
import { useWorkspaceStore } from '@/store/workspace-store';
import { formatBytes } from '@/lib/format';

const navItems = [
  { id: 'home', label: 'Workbench', icon: Sparkles },
  { id: 'spaces', label: 'Spaces', icon: BookOpenText },
  { id: 'documents', label: 'Documents', icon: BookOpen },
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

const pageLabels: Record<string, string> = {
  home: 'Workbench',
  spaces: 'Knowledge Spaces',
  documents: 'Document Workspace',
  explore: 'Explore Workspace',
  settings: 'Settings',
  dashboard: 'Workbench',
  search: 'Explore Workspace',
  notes: 'Explore Workspace',
  import: 'Explore Workspace',
  timeline: 'Explore Workspace',
  tags: 'Explore Workspace',
  chat: 'Workbench',
  graph: 'Explore Workspace',
  reader: 'Document Workspace',
  editor: 'Document Workspace',
  mindmap: 'Explore Workspace',
  report: 'Explore Workspace',
  podcast: 'Explore Workspace',
  entities: 'Explore Workspace',
};

export function Sidebar() {
  const { currentPage, setPage, sidebarCollapsed, toggleSidebar, stats, kbPath, isKbOpen } = useKbStore();

  return (
    <aside
      className={`${
        sidebarCollapsed ? 'w-[86px]' : 'w-[220px]'
      } kb-shell shrink-0 border-r border-white/10 text-white transition-all duration-200 ease-out`}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between px-4">
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="kb-chip flex h-11 w-11 items-center justify-center rounded-2xl text-amber-200">
              <Sparkles className="h-5 w-5" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <div className="text-sm font-semibold tracking-tight">ClawKB</div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Workbench</div>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8 rounded-xl text-slate-400 hover:bg-white/6 hover:text-white"
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
              className="h-10 w-10 rounded-2xl text-slate-400 hover:bg-white/6 hover:text-white"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

        <nav className="mt-6 flex flex-col gap-2 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            const button = (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`group flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                  isActive
                    ? 'border-amber-200/30 bg-amber-200/12 text-white'
                    : 'border-transparent text-slate-400 hover:border-white/8 hover:bg-white/4 hover:text-white'
                } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                    isActive ? 'bg-black/20 text-amber-200' : 'bg-white/4'
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                {!sidebarCollapsed && (
                  <div>
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      {item.id}
                    </div>
                  </div>
                )}
              </button>
            );

            if (sidebarCollapsed) {
              return (
                <TooltipProvider key={item.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right" className="rounded-xl border-white/10 bg-slate-950 text-xs text-white">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }

            return button;
          })}
        </nav>

        {!sidebarCollapsed && (
          <div className="mt-4 min-h-0 flex-1 overflow-hidden border-t border-white/8 px-3 pt-4">
            <FolderTree />
          </div>
        )}

        <div className="border-t border-white/8 px-4 py-4">
          {isKbOpen && stats ? (
            <div className={`kb-panel-strong rounded-2xl p-3 ${sidebarCollapsed ? 'text-center' : ''}`}>
              <div className={`flex items-center gap-2 ${sidebarCollapsed ? 'justify-center' : ''}`}>
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                {!sidebarCollapsed && (
                  <span className="truncate text-xs font-medium text-white">{kbPath.split('/').pop()}</span>
                )}
              </div>
              {!sidebarCollapsed ? (
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{stats.frame_count} docs</span>
                  <span>{formatBytes(stats.size_bytes)}</span>
                </div>
              ) : (
                <div className="mt-2 text-[10px] text-slate-500">{stats.frame_count}</div>
              )}
            </div>
          ) : (
            <div className={`kb-panel-strong rounded-2xl border-dashed p-3 text-[11px] text-slate-500 ${sidebarCollapsed ? 'text-center' : ''}`}>
              {sidebarCollapsed ? 'KB' : 'Open a knowledge base to activate the workspace.'}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export function Header() {
  const { currentPage, darkMode, toggleDarkMode, setPage } = useKbStore();
  const { openExploreView } = useWorkspaceStore();
  const runtimeInfo = getRuntimeModeInfo();

  const handleSearchClick = () => {
    openExploreView('search');
    setPage('explore');
  };

  return (
    <header className="kb-panel-strong flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-5 text-white">
      <button
        onClick={handleSearchClick}
        className="kb-chip flex h-10 w-full max-w-sm items-center gap-2.5 rounded-full px-4 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Search your knowledge base…</span>
        <kbd className="ml-auto hidden rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-slate-400 sm:inline-block">
          ⌘K
        </kbd>
      </button>

      <div className="ml-4 flex items-center gap-3">
        {isBrowserPreview() && (
          <span
            data-runtime-badge
            title={runtimeInfo.summary}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/20 bg-amber-200/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-amber-100/80"
          >
            <Monitor className="h-3 w-3" />
            {runtimeInfo.badge}
          </span>
        )}
        <span className="hidden text-sm font-medium text-slate-300 lg:inline">{pageLabels[currentPage] ?? currentPage}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDarkMode}
          className="h-9 w-9 rounded-full text-slate-400 hover:bg-white/6 hover:text-white"
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
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[rgba(8,10,15,0.92)] px-2 py-2 backdrop-blur-xl md:hidden">
      <div className="flex justify-around gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] transition ${
                isActive ? 'bg-amber-200/12 text-white' : 'text-slate-500'
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

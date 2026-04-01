import {
  Search, FileText, Upload, Clock, Tag, Link2, Settings,
  PanelLeftClose, PanelLeft, Sun, Moon, Database, Sparkles,
  Monitor, MessageCircle, GitBranch, BookOpen, PenLine, Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useKbStore } from '@/store/kb-store';
import { FolderTree } from '@/components/folder-tree';
import { isTauri } from '@/api/platform';
import { formatBytes } from '@/lib/format';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Database, group: 'overview' },
  { id: 'search', label: 'Search', icon: Search, group: 'overview' },
  { id: 'chat', label: 'Chat', icon: MessageCircle, group: 'overview' },
  { id: 'reader', label: 'Reader', icon: BookOpen, group: 'content' },
  { id: 'editor', label: 'Editor', icon: PenLine, group: 'content' },
  { id: 'notes', label: 'Notes', icon: FileText, group: 'content' },
  { id: 'import', label: 'Import', icon: Upload, group: 'content' },
  { id: 'timeline', label: 'Timeline', icon: Clock, group: 'explore' },
  { id: 'tags', label: 'Tags', icon: Tag, group: 'explore' },
  { id: 'entities', label: 'Entities', icon: Link2, group: 'explore' },
  { id: 'graph', label: 'Graph', icon: GitBranch, group: 'explore' },
  { id: 'mindmap', label: 'Mind Map', icon: Brain, group: 'explore' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'system' },
] as const;

const groups = [
  { id: 'overview', label: '' },
  { id: 'content', label: 'Content' },
  { id: 'explore', label: 'Explore' },
  { id: 'system', label: '' },
];

export function Sidebar() {
  const { currentPage, setPage, sidebarCollapsed, toggleSidebar, stats, kbPath, isKbOpen } = useKbStore();

  return (
    <aside className={`${sidebarCollapsed ? 'w-[60px]' : 'w-[220px]'} bg-card/80 backdrop-blur-sm border-r flex flex-col transition-all duration-200 ease-in-out shrink-0`}>
      {/* Logo Area */}
      <div className="h-14 flex items-center justify-between px-3 shrink-0">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-foreground leading-none">ClawKB</h1>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">Knowledge Base</p>
            </div>
          </div>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground"
              >
                {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {sidebarCollapsed ? 'Expand' : 'Collapse'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2">
        <nav className="py-1">
          {groups.map((group) => {
            const groupItems = navItems.filter(item => item.group === group.id);
            return (
              <div key={group.id} className="mb-1">
                {!sidebarCollapsed && group.label && (
                  <div className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                    {group.label}
                  </div>
                )}
                {groupItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  return (
                    <TooltipProvider key={item.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setPage(item.id)}
                            className={`
                              w-full flex items-center gap-2.5 rounded-lg text-[13px] transition-colors duration-100 cursor-pointer
                              ${sidebarCollapsed ? 'justify-center px-0 py-2' : 'px-2.5 py-[7px]'}
                              ${isActive
                                ? 'bg-primary/8 text-primary font-medium'
                                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                              }
                            `}
                          >
                            <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={isActive ? 2 : 1.5} />
                            {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                          </button>
                        </TooltipTrigger>
                        {sidebarCollapsed && (
                          <TooltipContent side="right" className="text-xs">
                            {item.label}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Folder Tree */}
        {!sidebarCollapsed && (
          <div className="mt-3 border-t pt-2">
            <FolderTree />
          </div>
        )}
      </ScrollArea>

      {/* KB Status Footer */}
      {isKbOpen && stats && !sidebarCollapsed && (
        <div className="px-3 py-3 border-t mx-2 mb-2">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-xs font-medium text-foreground truncate">
              {kbPath.split('/').pop()}
            </span>
          </div>
          <div className="flex gap-3 text-[11px] text-muted-foreground ml-4">
            <span>{stats.frame_count} docs</span>
            <span>{formatBytes(stats.size_bytes)}</span>
          </div>
        </div>
      )}
    </aside>
  );
}

export function Header() {
  const { currentPage, darkMode, toggleDarkMode, setPage } = useKbStore();

  const handleSearchClick = () => {
    setPage('search');
  };

  return (
    <header className="h-13 flex items-center justify-between px-5 shrink-0 bg-card/60 backdrop-blur-sm border-b">
      {/* Search trigger */}
      <button
        onClick={handleSearchClick}
        className="flex items-center gap-2.5 h-8 px-3 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-[13px] w-full max-w-xs cursor-pointer"
      >
        <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
        <span className="truncate">Search knowledge base...</span>
        <kbd className="ml-auto text-[10px] bg-background/60 px-1.5 py-0.5 rounded text-muted-foreground/60 font-mono hidden sm:inline-block">
          ⌘K
        </kbd>
      </button>

      {/* Page title + Platform + Dark mode */}
      <div className="flex items-center gap-2">
        {!isTauri() && (
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md font-medium">
            <Monitor className="h-3 w-3" /> Demo
          </span>
        )}
        <span className="text-xs text-muted-foreground font-medium capitalize hidden sm:inline">
          {currentPage}
        </span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground"
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Toggle theme</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  );
}

export function MobileBottomNav() {
  const { currentPage, setPage } = useKbStore();
  const mobileItems = [
    { id: 'dashboard', icon: Database, label: 'Home' },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'notes', icon: FileText, label: 'Notes' },
    { id: 'timeline', icon: Clock, label: 'Timeline' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-lg border-t md:hidden safe-area-pb z-40">
      <div className="flex justify-around py-1.5 px-2">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors cursor-pointer ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

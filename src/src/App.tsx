import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Monitor, MonitorOff } from 'lucide-react';
import { Sidebar, Header, MobileBottomNav } from '@/components/layout';
import { DocumentDetailPanel } from '@/components/document-detail';
import { SelectionPanel } from '@/components/selection-panel';
import { Toaster } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/error-boundary';
import { CommandPalette } from '@/components/command/command-palette';
import { getRuntimeMode, isBrowserPreview } from '@/api/platform';
import { api } from '@/api/commands';
import { useKbStore } from '@/store/kb-store';
import { STORAGE_KEYS, safeStorageGetString } from '@/store/persistence';
import { useWorkspaceStore } from '@/store/workspace-store';
import './index.css';

const DocumentWorkspaceShell = lazy(() => import('@/components/shell/document-workspace-shell').then((module) => ({ default: module.DocumentWorkspaceShell })));
const ExploreShell = lazy(() => import('@/components/shell/explore-shell').then((module) => ({ default: module.ExploreShell })));
const KnowledgeSpaceShell = lazy(() => import('@/components/shell/knowledge-space-shell').then((module) => ({ default: module.KnowledgeSpaceShell })));
const WorkbenchShell = lazy(() => import('@/components/shell/workbench-shell').then((module) => ({ default: module.WorkbenchShell })));
const SettingsPage = lazy(() => import('@/components/pages/settings').then((module) => ({ default: module.SettingsPage })));

const shellPages: Record<string, React.ComponentType> = {
  home: WorkbenchShell,
  spaces: KnowledgeSpaceShell,
  documents: ExploreShell,
  explore: ExploreShell,
  settings: SettingsPage,
  dashboard: WorkbenchShell,
  chat: WorkbenchShell,
  search: ExploreShell,
  notes: ExploreShell,
  import: ExploreShell,
  timeline: ExploreShell,
  tags: ExploreShell,
  graph: ExploreShell,
  mindmap: ExploreShell,
  report: ExploreShell,
  podcast: ExploreShell,
  reader: DocumentWorkspaceShell,
  editor: DocumentWorkspaceShell,
  entities: ExploreShell,
};

function App() {
  const { currentPage, darkMode, openKb } = useKbStore();
  const { openExploreView } = useWorkspaceStore();
  const [selectionPanelOpen, setSelectionPanelOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const previewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.dataset.runtimeMode = getRuntimeMode();
  }, []);

  useEffect(() => {
    const openDefaultKb = async () => {
      if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;

      try {
        const lastPath = safeStorageGetString(STORAGE_KEYS.kb.lastPath, '');
        if (lastPath) {
          await openKb(lastPath);
          return;
        }
      } catch {
        // Ignore localStorage access failures.
      }

      try {
        const { homeDir } = await import('@tauri-apps/api/path');
        const home = await homeDir();
        const normalizedHome = home.replace(/[\\/]+$/, '');
        await openKb(`${normalizedHome}/.clawkb/knowledge.mv2`);
      } catch {
        // If resolving the default path fails, keep the app usable and let the user open a KB manually.
      }
    };

    openDefaultKb();
  }, [openKb]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openExploreView('search');
        useKbStore.getState().setPage('explore');
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      // Cmd+Shift+D: 打开或创建今日日记
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'd') {
        e.preventDefault();
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10); // YYYY-MM-DD
        const dailyTitle = `Daily Note ${dateStr}`;
        void (async () => {
          try {
            // 先搜索今日日记是否已存在
            const hits = await api.search(dailyTitle, 1, 'lex');
            if (hits.length > 0 && hits[0].title === dailyTitle) {
              useKbStore.getState().openDocument(hits[0]);
            } else {
              // 创建新日记
              const template = `# ${dateStr}\n\n`;
              await api.addNote(dailyTitle, template, ['daily']);
              const newHits = await api.search(dailyTitle, 1, 'lex');
              if (newHits.length > 0) {
                useKbStore.getState().openDocument(newHits[0]);
              }
            }
            useKbStore.getState().setPage('editor');
          } catch (err) {
            console.error('[Cmd+Shift+D] 创建今日日记失败:', err);
          }
        })();
      }
      if (e.key === 'Escape') {
        useKbStore.getState().closeDocument();
        setSelectionPanelOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openExploreView]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      if (!('__TAURI_INTERNALS__' in window)) return;
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen('global-shortcut', async () => {
          let clipboardText = '';
          try {
            const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
            clipboardText = await readText();
          } catch {
            clipboardText = window.getSelection()?.toString() || '';
          }
          setSelectedText(clipboardText);
          setSelectionPanelOpen(true);
        });
      } catch {
        // Not in Tauri or plugin not available.
      }
    };

    setup();
    return () => {
      unlisten?.();
    };
  }, []);

  if (isBrowserPreview()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,_rgba(6,8,13,1)_0%,_rgba(13,16,23,1)_100%)] p-6 text-white">
        <div
          ref={previewRef}
          className="w-full max-w-3xl rounded-[32px] border border-white/10 bg-black/30 p-8 shadow-[0_32px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-100/80">
            <Monitor className="h-3.5 w-3.5" />
            Preview Only
          </div>
          <div className="mt-6 flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/6 text-amber-200">
              <MonitorOff className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Desktop runtime required</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                ClawKB no longer ships browser sample data or placeholder knowledge-base flows. Open the Tauri desktop app to work with a real local `.mv2` knowledge base.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Available Here</div>
              <p className="mt-3 text-sm text-slate-300">
                Runtime messaging checks, visual QA, and automated preview verification.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Requires Desktop</div>
              <p className="mt-3 text-sm text-slate-300">
                Opening or creating a KB, import, search, OCR, sync, and all native file actions.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              className="rounded-full px-5"
              onClick={() => window.location.reload()}
            >
              Recheck Runtime
            </Button>
            <p className="text-xs text-slate-400">
              Open the Tauri desktop app from this repository to continue with real data.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const PageComponent = shellPages[currentPage] || WorkbenchShell;

  return (
    <div className="flex h-screen bg-[linear-gradient(180deg,_rgba(6,8,13,1)_0%,_rgba(13,16,23,1)_100%)] text-foreground">
      <Sidebar />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <div className="flex-1 overflow-auto pb-16 md:pb-0">
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  Loading workspace...
                </div>
              }
            >
              <PageComponent />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      <DocumentDetailPanel />

      <MobileBottomNav />
      <Toaster />
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />

      <SelectionPanel
        visible={selectionPanelOpen}
        selectedText={selectedText}
        onClose={() => setSelectionPanelOpen(false)}
      />
    </div>
  );
}

export default App;

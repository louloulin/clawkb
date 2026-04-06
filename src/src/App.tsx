import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Sidebar, Header, MobileBottomNav } from '@/components/layout';
import { DocumentDetailPanel } from '@/components/document-detail';
import { SelectionPanel } from '@/components/selection-panel';
import { Toaster } from '@/components/ui/toaster';
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
  documents: DocumentWorkspaceShell,
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
  const { currentPage, darkMode, openKb, isKbOpen } = useKbStore();
  const { openExploreView } = useWorkspaceStore();
  const [selectionPanelOpen, setSelectionPanelOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const demoInitRef = useRef(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
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
    if (typeof window === 'undefined') return;
    if ('__TAURI_INTERNALS__' in window) return;
    if (isKbOpen || demoInitRef.current) return;

    demoInitRef.current = true;
    openKb('/demo/clawkb-demo');
  }, [isKbOpen, openKb]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openExploreView('search');
        useKbStore.getState().setPage('explore');
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

  const PageComponent = shellPages[currentPage] || WorkbenchShell;

  return (
    <div className="flex h-screen bg-[linear-gradient(180deg,_rgba(6,8,13,1)_0%,_rgba(13,16,23,1)_100%)] text-foreground">
      <Sidebar />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <div className="flex-1 overflow-auto pb-16 md:pb-0">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Loading workspace...
              </div>
            }
          >
            <PageComponent />
          </Suspense>
        </div>
      </main>

      <DocumentDetailPanel />

      <MobileBottomNav />
      <Toaster />

      <SelectionPanel
        visible={selectionPanelOpen}
        selectedText={selectedText}
        onClose={() => setSelectionPanelOpen(false)}
      />
    </div>
  );
}

export default App;

import { useEffect, useState } from 'react';
import { Sidebar, Header, MobileBottomNav } from '@/components/layout';
import { DocumentDetailPanel } from '@/components/document-detail';
import { SelectionPanel } from '@/components/selection-panel';
import { DashboardPage } from '@/components/pages/dashboard';
import { SearchPage } from '@/components/pages/search';
import { ChatPage } from '@/components/pages/chat';
import { GraphPage } from '@/components/pages/graph';
import { ReaderPage } from '@/components/pages/reader';
import { EditorPage } from '@/components/pages/editor';
import { MindMapPage } from '@/components/pages/mindmap';
import { NotesPage } from '@/components/pages/notes';
import { ImportPage } from '@/components/pages/import';
import { TimelinePage } from '@/components/pages/timeline';
import { TagsPage } from '@/components/pages/tags';
import { EntitiesPage } from '@/components/pages/entities';
import { SettingsPage } from '@/components/pages/settings';
import { ReportPage } from '@/components/pages/report';
import { PodcastPage } from '@/components/pages/podcast';
import { Toaster } from '@/components/ui/toaster';
import { useKbStore } from '@/store/kb-store';
import './index.css';

const pages: Record<string, React.ComponentType> = {
  dashboard: DashboardPage,
  search: SearchPage,
  chat: ChatPage,
  graph: GraphPage,
  reader: ReaderPage,
  editor: EditorPage,
  mindmap: MindMapPage,
  notes: NotesPage,
  import: ImportPage,
  timeline: TimelinePage,
  tags: TagsPage,
  entities: EntitiesPage,
  report: ReportPage,
  podcast: PodcastPage,
  settings: SettingsPage,
};

function App() {
  const { currentPage, darkMode, openKb } = useKbStore();
  const [selectionPanelOpen, setSelectionPanelOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');

  // Apply dark mode on mount
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, []);

  // Auto-open KB in Tauri
  useEffect(() => {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      openKb('/.clawkb/knowledge.mv2');
    }
  }, [openKb]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        useKbStore.getState().setPage('search');
      }
      if (e.key === 'Escape') {
        useKbStore.getState().closeDocument();
        setSelectionPanelOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Listen for global shortcut event from Tauri backend
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      if (!('__TAURI_INTERNALS__' in window)) return;
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen('global-shortcut', async () => {
          // Read clipboard text when shortcut is triggered
          let clipboardText = '';
          try {
            const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
            clipboardText = await readText();
          } catch {
            // Fallback: use window selection
            clipboardText = window.getSelection()?.toString() || '';
          }
          setSelectedText(clipboardText);
          setSelectionPanelOpen(true);
        });
      } catch {
        // Not in Tauri or plugin not available
      }
    };

    setup();
    return () => {
      unlisten?.();
    };
  }, []);

  const PageComponent = pages[currentPage] || DashboardPage;

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />

      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        <Header />
        <div className="flex-1 overflow-auto pb-16 md:pb-0">
          <PageComponent />
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

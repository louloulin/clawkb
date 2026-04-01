import { useEffect } from 'react';
import { Sidebar, Header, MobileBottomNav } from '@/components/layout';
import { DocumentDetailPanel } from '@/components/document-detail';
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
  settings: SettingsPage,
};

function App() {
  const { currentPage, darkMode, openKb } = useKbStore();

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

  // Global keyboard shortcut: Cmd/Ctrl+K -> search, Escape -> close document
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        useKbStore.getState().setPage('search');
      }
      if (e.key === 'Escape') {
        useKbStore.getState().closeDocument();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
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
    </div>
  );
}

export default App;

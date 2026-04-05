import { BookOpen, NotebookText, Search, Upload, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EditorPage } from '@/components/pages/editor';
import { ReaderPage } from '@/components/pages/reader';
import { useKbStore } from '@/store/kb-store';
import { useWorkspaceStore } from '@/store/workspace-store';

export function DocumentWorkspaceShell() {
  const { kbPath, stats, setPage } = useKbStore();
  const { activeDocumentsView, setActiveDocumentsView, openExploreView } = useWorkspaceStore();

  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,_rgba(15,17,23,1)_0%,_rgba(21,24,33,1)_100%)] text-white">
      <div className="border-b border-white/10 bg-black/20 px-5 py-4 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Document Workspace</div>
            <h1 className="mt-2 text-2xl font-semibold">Read the source, annotate it, then branch into action.</h1>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              This shell keeps reading as the primary document task while the future unified write/generate workspace is still being built.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                openExploreView('search');
                setPage('explore');
              }}
              variant="outline"
              className="h-10 rounded-full border-white/10 bg-white/4 px-4 text-white hover:bg-white/10"
            >
              <Search className="mr-2 h-4 w-4" />
              Search KB
            </Button>
            <Button
              onClick={() => {
                openExploreView('notes');
                setPage('explore');
              }}
              variant="outline"
              className="h-10 rounded-full border-white/10 bg-white/4 px-4 text-white hover:bg-white/10"
            >
              <NotebookText className="mr-2 h-4 w-4" />
              Capture Notes
            </Button>
            <Button
              onClick={() => {
                openExploreView('import');
                setPage('explore');
              }}
              className="h-10 rounded-full bg-amber-300 px-4 text-slate-950 hover:bg-amber-200"
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Sources
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
            <BookOpen className="mr-1.5 inline h-3.5 w-3.5" />
            {kbPath ? kbPath.split('/').pop() : 'No KB open'}
          </span>
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
            {stats?.frame_count ?? 0} docs available
          </span>
        </div>

        <Tabs value={activeDocumentsView} onValueChange={(value) => setActiveDocumentsView(value as 'reader' | 'draft')} className="mt-4">
          <TabsList className="h-auto rounded-2xl border border-white/10 bg-white/6 p-1">
            <TabsTrigger value="reader" className="rounded-xl px-3 py-2 text-xs data-[state=active]:bg-black/50 data-[state=active]:text-white">
              Reader Workspace
            </TabsTrigger>
            <TabsTrigger value="draft" className="rounded-xl px-3 py-2 text-xs data-[state=active]:bg-black/50 data-[state=active]:text-white">
              Draft Lab
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="min-h-0 flex-1">
        {activeDocumentsView === 'reader' ? (
          <ReaderPage />
        ) : (
          <div className="flex h-full flex-col">
            <div className="border-b border-white/10 bg-black/20 px-5 py-3 text-sm text-slate-300">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-200/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-100/80">
                <AlertTriangle className="h-3.5 w-3.5" />
                Draft Lab
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
                The editor now lives inside the document shell, but its AI writing flow is still a draft-only lab until real persistence is completed in a later phase.
              </p>
            </div>
            <div className="min-h-0 flex-1">
              <EditorPage />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

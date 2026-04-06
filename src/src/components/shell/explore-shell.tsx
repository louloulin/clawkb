import { lazy, Suspense } from 'react';
import { Compass, Search, Sparkles } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorkspaceStore, type ExploreView } from '@/store/workspace-store';

const SearchPage = lazy(() => import('@/components/pages/search').then((module) => ({ default: module.SearchPage })));
const ImportPage = lazy(() => import('@/components/pages/import').then((module) => ({ default: module.ImportPage })));
const NotesPage = lazy(() => import('@/components/pages/notes').then((module) => ({ default: module.NotesPage })));
const TimelinePage = lazy(() => import('@/components/pages/timeline').then((module) => ({ default: module.TimelinePage })));
const TagsPage = lazy(() => import('@/components/pages/tags').then((module) => ({ default: module.TagsPage })));
const EntitiesPage = lazy(() => import('@/components/pages/entities').then((module) => ({ default: module.EntitiesPage })));
const GraphPage = lazy(() => import('@/components/pages/graph').then((module) => ({ default: module.GraphPage })));
const MindMapPage = lazy(() => import('@/components/pages/mindmap').then((module) => ({ default: module.MindMapPage })));
const ReportPage = lazy(() => import('@/components/pages/report').then((module) => ({ default: module.ReportPage })));
const PodcastPage = lazy(() => import('@/components/pages/podcast').then((module) => ({ default: module.PodcastPage })));

const VIEWS: Array<{
  id: ExploreView;
  label: string;
  shortLabel: string;
}> = [
  { id: 'search', label: 'Search', shortLabel: 'Search' },
  { id: 'import', label: 'Import', shortLabel: 'Import' },
  { id: 'notes', label: 'Notes', shortLabel: 'Notes' },
  { id: 'timeline', label: 'Timeline', shortLabel: 'Timeline' },
  { id: 'tags', label: 'Tags', shortLabel: 'Tags' },
  { id: 'entities', label: 'Entities', shortLabel: 'Entities' },
  { id: 'graph', label: 'Graph', shortLabel: 'Graph' },
  { id: 'mindmap', label: 'Mind Map', shortLabel: 'Mind Map' },
  { id: 'report', label: 'Report', shortLabel: 'Report' },
  { id: 'podcast', label: 'Podcast', shortLabel: 'Podcast' },
];

const viewRenderers: Record<ExploreView, React.ReactNode> = {
  search: <SearchPage />,
  import: <ImportPage />,
  notes: <NotesPage />,
  timeline: <TimelinePage />,
  tags: <TagsPage />,
  entities: <EntitiesPage />,
  graph: <GraphPage />,
  mindmap: <MindMapPage />,
  report: <ReportPage />,
  podcast: <PodcastPage />,
};

export function ExploreShell() {
  const { activeExploreView, setActiveExploreView } = useWorkspaceStore();

  return (
    <div className="kb-shell flex h-full flex-col text-white">
      <div className="border-b border-white/10 bg-black/20 px-5 py-4 backdrop-blur-xl">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Explore Workspace</div>
              <h1 className="mt-2 text-2xl font-semibold">One place for search, collection, structure, and generated outputs.</h1>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                The old standalone utility pages now live under a single explore shell so the top-level product model stays focused.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
                <Compass className="mr-1.5 inline h-3.5 w-3.5" />
                Explore
              </span>
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
                <Search className="mr-1.5 inline h-3.5 w-3.5" />
                Search-first
              </span>
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
                <Sparkles className="mr-1.5 inline h-3.5 w-3.5" />
                Research tools
              </span>
            </div>
          </div>

          <Tabs value={activeExploreView} onValueChange={(value) => setActiveExploreView(value as ExploreView)}>
            <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-2xl border border-white/10 bg-white/6 p-1">
              {VIEWS.map((view) => (
                <TabsTrigger
                  key={view.id}
                  value={view.id}
                  className="rounded-xl px-3 py-2 text-xs data-[state=active]:bg-black/60 data-[state=active]:text-white"
                >
                  {view.shortLabel}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-transparent">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Loading explore view...
            </div>
          }
        >
          {viewRenderers[activeExploreView]}
        </Suspense>
      </div>
    </div>
  );
}

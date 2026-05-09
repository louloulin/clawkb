import { lazy, Suspense, useMemo, useState } from 'react';
import { ChevronDown, Compass, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

const PRIMARY_VIEWS: Array<{
  id: ExploreView;
  label: string;
  shortLabel: string;
}> = [
  { id: 'search', label: '搜索', shortLabel: '搜索' },
  { id: 'import', label: '导入', shortLabel: '导入' },
];

const ADVANCED_VIEWS: Array<{
  id: ExploreView;
  label: string;
  shortLabel: string;
}> = [
  { id: 'timeline', label: '时间线', shortLabel: '时间线' },
  { id: 'tags', label: '标签', shortLabel: '标签' },
  { id: 'entities', label: '实体', shortLabel: '实体' },
  { id: 'graph', label: '图谱', shortLabel: '图谱' },
  { id: 'mindmap', label: '脑图', shortLabel: '脑图' },
  { id: 'report', label: '报告', shortLabel: '报告' },
  { id: 'podcast', label: '播客', shortLabel: '播客' },
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
  const [showAdvanced, setShowAdvanced] = useState(
    ['timeline', 'tags', 'entities', 'graph', 'mindmap', 'report', 'podcast'].includes(activeExploreView),
  );
  const visibleViews = useMemo(
    () => (showAdvanced ? [...PRIMARY_VIEWS, ...ADVANCED_VIEWS] : PRIMARY_VIEWS),
    [showAdvanced],
  );

  return (
    <div className="kb-shell flex h-full flex-col text-foreground">
      <div className="border-b border-border bg-secondary px-5 py-4 backdrop-blur-xl">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">资料工作面</div>
              <h1 className="mt-2 text-2xl font-semibold">先搜索、导入和整理资料，再进入阅读与笔记沉淀。</h1>
              <p className="mt-2 text-sm leading-7 text-foreground/80">
                这里负责管理你的来源资料：搜索、导入、快速整理，以及按需展开时间线、图谱和报告等高级资料工具。
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-foreground/80">
              <span className="rounded-full border border-border bg-muted/50 px-3 py-1">
                <Compass className="mr-1.5 inline h-3.5 w-3.5" />
                资料
              </span>
              <span className="rounded-full border border-border bg-muted/50 px-3 py-1">
                <Search className="mr-1.5 inline h-3.5 w-3.5" />
                搜索优先
              </span>
              <span className="rounded-full border border-border bg-muted/50 px-3 py-1">
                <Sparkles className="mr-1.5 inline h-3.5 w-3.5" />
                高级资料工具
              </span>
            </div>
          </div>

          <Tabs value={activeExploreView} onValueChange={(value) => setActiveExploreView(value as ExploreView)}>
            <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-2xl border border-border bg-muted/50 p-1">
              {visibleViews.map((view) => (
                <TabsTrigger
                  key={view.id}
                  value={view.id}
                  className="rounded-xl px-3 py-2 text-xs data-[state=active]:bg-card/80 data-[state=active]:text-foreground"
                >
                  {view.shortLabel}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className="h-10 rounded-full border-border bg-secondary px-4 text-xs uppercase tracking-[0.18em] text-foreground hover:bg-accent"
            >
              <ChevronDown className={`mr-2 h-4 w-4 transition ${showAdvanced ? 'rotate-180' : ''}`} />
              {showAdvanced ? '隐藏高级资料工具' : '显示高级资料工具'}
            </Button>
            <p className="text-xs text-muted-foreground">
              高级资料工具仍然可用，但主路径只把 Search 和 Import 作为第一层入口。
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-transparent">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
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

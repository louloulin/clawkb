import { useEffect, useState } from 'react';
import { Clock3, FolderPlus, MessageSquareQuote, Orbit, Save, Search, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RegistrySpace } from '@/store/kb-registry-store';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SearchHit } from '@/api';
import { ScrollArea } from '@/components/ui/scroll-area';

interface KbDetailPaneProps {
  selectedSpace: RegistrySpace | null;
  isCurrent: boolean;
  switching: boolean;
  previewQuery: string;
  previewHits: SearchHit[];
  previewLoading: boolean;
  onPreviewQueryChange: (query: string) => void;
  onPreviewSearch: (query?: string) => void;
  onOpenAsk: () => void;
  onOpenNotes: (hit?: SearchHit) => void;
  onRegisterCurrent: () => void;
  showRegisterCurrent: boolean;
  onSaveMetadata: (updates: { name: string; description: string; collection: 'created' | 'joined' | 'shared' }) => Promise<void>;
}

export function KbDetailPane({
  selectedSpace,
  isCurrent,
  switching,
  previewQuery,
  previewHits,
  previewLoading,
  onPreviewQueryChange,
  onPreviewSearch,
  onOpenAsk,
  onOpenNotes,
  onRegisterCurrent,
  showRegisterCurrent,
  onSaveMetadata,
}: KbDetailPaneProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [collection, setCollection] = useState<'created' | 'joined' | 'shared'>('created');
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!selectedSpace || selectedSpace.kind !== 'registered') return;
    setName(selectedSpace.name);
    setDescription(selectedSpace.description);
    setCollection(selectedSpace.collection === 'personal' ? 'created' : selectedSpace.collection);
  }, [selectedSpace?.id]);

  if (!selectedSpace) {
    return (
      <div className="flex h-full items-center justify-center rounded-[2rem] border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm leading-7 text-slate-400">
        先从左侧选一个知识库。这里会直接展示当前资料、提问入口和笔记入口。
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] border border-white/10 bg-black/20 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-400">
          <Orbit className="h-3.5 w-3.5" />
          {isCurrent ? '当前知识库' : '已保存知识库'}
        </div>
        <h2 className="mt-4 text-3xl font-semibold text-white">{selectedSpace.name}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{selectedSpace.description}</p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full border border-white/10 bg-white/4 px-3 py-2 text-slate-200">
          资料：{selectedSpace.stats?.frame_count ?? '—'}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-3 py-2 text-emerald-300">
          <MessageSquareQuote className="h-4 w-4" />
          先选知识库，再回到资料或笔记继续工作
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-3 py-2 text-slate-300">
          <Clock3 className="h-4 w-4" />
          {isCurrent ? '当前正在使用' : selectedSpace.lastOpenedAt ? '之前打开过' : '已保存待用'}
        </span>
        <span className="rounded-full border border-white/10 bg-white/4 px-3 py-2 text-slate-400">
          {selectedSpace.path.split('/').pop()}
        </span>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          onClick={onOpenAsk}
          disabled={switching}
          className="h-11 rounded-full bg-amber-300 px-5 text-sm font-medium text-slate-950 hover:bg-amber-200"
        >
          {switching ? '切换中…' : isCurrent ? '进入资料' : '切换后进入资料'}
        </Button>
        {showRegisterCurrent && (
          <Button
            onClick={onRegisterCurrent}
            variant="outline"
            className="h-11 rounded-full border-white/10 bg-white/4 px-5 text-sm text-white hover:bg-white/10"
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            收藏当前知识库
          </Button>
        )}
        <Button
          onClick={() => onOpenNotes()}
          variant="ghost"
          className="h-11 rounded-full px-5 text-sm text-slate-300 hover:bg-white/6 hover:text-white"
        >
          <Workflow className="mr-2 h-4 w-4" />
          {isCurrent ? '进入笔记' : '切换后进入笔记'}
        </Button>
        {selectedSpace.kind === 'registered' && (
          <Button
            onClick={() => setShowSettings((value) => !value)}
            variant="outline"
            className="h-11 rounded-full border-white/10 bg-white/4 px-5 text-sm text-white hover:bg-white/10"
          >
            {showSettings ? '收起知识库设置' : '编辑知识库设置'}
          </Button>
        )}
      </div>

      <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">当前资料</div>
            <div className="mt-2 text-sm text-slate-300">
              先浏览当前资料，再点开一篇直接进入笔记。
            </div>
          </div>
          <div className="flex w-full gap-2 md:max-w-[420px]">
            <Input
              value={previewQuery}
              onChange={(event) => onPreviewQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onPreviewSearch(previewQuery);
                }
              }}
              placeholder="搜索当前资料"
              className="h-10 rounded-full border-white/10 bg-black/20 text-white placeholder:text-slate-500"
            />
            <Button
              onClick={() => onPreviewSearch(previewQuery)}
              variant="outline"
              className="h-10 rounded-full border-white/10 bg-white/4 px-4 text-white hover:bg-white/10"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="mt-5 h-[240px]">
          <div className="grid gap-4 pr-3 sm:grid-cols-2 xl:grid-cols-3">
            {previewLoading ? (
              <div className="rounded-[1rem] border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                正在加载资料…
              </div>
            ) : previewHits.length === 0 ? (
              <div className="rounded-[1rem] border border-dashed border-white/10 bg-black/20 p-4 text-sm leading-7 text-slate-400">
                还没有资料。先导入文件或网页，这里就会展示当前知识库的内容卡片。
              </div>
            ) : (
              previewHits.map((hit) => (
                <button
                  key={`${selectedSpace.id}-${hit.id}-${hit.title}`}
                  onClick={() => onOpenNotes(hit)}
                  className="rounded-[1rem] border border-white/10 bg-black/20 p-4 text-left transition hover:border-white/20 hover:bg-black/30"
                >
                  <div className="line-clamp-2 text-sm font-medium text-white">{hit.title}</div>
                  <div className="mt-3 line-clamp-4 text-xs leading-6 text-slate-400">{hit.content}</div>
                  <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                    <span>{hit.source ? hit.source.split('/').pop() : '当前知识库资料'}</span>
                    <span>点开进入笔记</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {selectedSpace.kind === 'registered' && showSettings && (
        <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/4 p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">知识库设置</div>
          <div className="mt-4 grid gap-3">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="知识库名称"
              className="h-10 rounded-xl border-white/10 bg-black/20 text-white placeholder:text-slate-500"
            />
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="一句话说明这个知识库存放什么"
              className="h-10 rounded-xl border-white/10 bg-black/20 text-white placeholder:text-slate-500"
            />
            <Select value={collection} onValueChange={(value) => setCollection(value as 'created' | 'joined' | 'shared')}>
              <SelectTrigger className="h-10 rounded-xl border-white/10 bg-black/20 text-white">
                <SelectValue placeholder="分组" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-slate-950 text-white">
                <SelectItem value="created">我的知识库</SelectItem>
                <SelectItem value="joined">归档知识库</SelectItem>
                <SelectItem value="shared">参考资料库</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={async () => {
                setSaving(true);
                try {
                  await onSaveMetadata({ name, description, collection });
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving || !name.trim()}
              className="h-10 rounded-full bg-amber-300 text-slate-950 hover:bg-amber-200"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? '保存中…' : '保存知识库设置'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

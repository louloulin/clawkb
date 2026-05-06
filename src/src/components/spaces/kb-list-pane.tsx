import { Library, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { RegistrySpace } from '@/store/kb-registry-store';

interface KbListPaneProps {
  title: string;
  spaces: RegistrySpace[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUnregister: (id: string) => void;
}

export function KbListPane({
  title,
  spaces,
  selectedId,
  onSelect,
  onUnregister,
}: KbListPaneProps) {
  const currentSpace = spaces.find((space) => space.kind === 'current') ?? null;
  const otherSpaces = spaces.filter((space) => space.kind !== 'current');

  return (
    <div className="flex h-full flex-col border-b border-white/10 bg-white/4 md:border-b-0 md:border-r">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{title}</div>
        <h3 className="mt-2 text-lg font-semibold text-white">切换当前工作知识库</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          当前页只负责管理和切换知识库。真正的搜索、阅读与笔记工作，回到资料和笔记页继续完成。
        </p>
      </div>

      <ScrollArea className="h-[calc(100vh-13rem)] md:h-[calc(100vh-7rem)]">
        <div className="space-y-6 p-4">
          {currentSpace && (
            <div>
              <div className="mb-3 text-[11px] uppercase tracking-[0.22em] text-slate-500">当前知识库</div>
              <KnowledgeBaseCard
                space={currentSpace}
                selected={selectedId === currentSpace.id}
                onSelect={onSelect}
                onUnregister={onUnregister}
              />
            </div>
          )}

          <div>
            <div className="mb-3 text-[11px] uppercase tracking-[0.22em] text-slate-500">其他知识库</div>
            {otherSpaces.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm leading-7 text-slate-400">
                还没有保存其他知识库。需要更多资料时，再去设置里打开或创建新的知识库。
              </div>
            ) : (
              <div className="space-y-3">
                {otherSpaces.map((space) => (
                  <KnowledgeBaseCard
                    key={space.id}
                    space={space}
                    selected={selectedId === space.id}
                    onSelect={onSelect}
                    onUnregister={onUnregister}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function KnowledgeBaseCard({
  space,
  selected,
  onSelect,
  onUnregister,
}: {
  space: RegistrySpace;
  selected: boolean;
  onSelect: (id: string) => void;
  onUnregister: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteClick = () => {
    if (confirmDelete) {
      onUnregister(space.id);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
  };

  return (
    <div
      className={`rounded-[1.4rem] border px-4 py-4 transition ${
        selected
          ? 'border-amber-200/40 bg-amber-200/10'
          : 'border-white/8 bg-black/20 hover:border-white/16 hover:bg-black/30'
      }`}
    >
      <button className="w-full text-left" onClick={() => onSelect(space.id)}>
        <div className="flex items-center justify-between gap-3">
          <div className="font-medium text-white">{space.name}</div>
          <span className="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-300">
            {space.kind === 'current'
              ? '当前'
              : space.collection === 'created'
                ? '已保存'
                : space.collection === 'joined'
                  ? '归档'
                  : '参考'}
          </span>
        </div>
        <div className="mt-3 text-xs leading-6 text-slate-400">{space.description}</div>
        <div className="mt-3 line-clamp-1 text-[11px] text-slate-500">{space.path}</div>
        {space.stats && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-2.5 py-1 text-[11px] text-slate-300">
            <Library className="h-3.5 w-3.5" />
            {space.stats.frame_count} 篇资料
          </div>
        )}
      </button>

      {space.kind === 'registered' && (
        <div className="mt-4 flex items-center justify-end gap-2">
          {confirmDelete ? (
            <>
              <span className="text-xs text-red-300">确认移除？</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteClick}
                className="h-8 rounded-full px-3 text-xs bg-red-500/10 text-red-300 hover:bg-red-500/20"
              >
                确认
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(false)}
                className="h-8 rounded-full px-3 text-xs text-slate-400"
              >
                取消
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              onClick={handleDeleteClick}
              className="h-8 rounded-full px-3 text-xs text-slate-400 hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              移除
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

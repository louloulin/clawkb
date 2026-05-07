import { FileText, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { SearchHit } from '@/api';

interface DocumentListPaneProps {
  documents: SearchHit[];
  selectedDocument: SearchHit | null;
  isLoading: boolean;
  onSelect: (doc: SearchHit) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function DocumentListPane({
  documents,
  selectedDocument,
  isLoading,
  onSelect,
  emptyTitle = '当前资料为空',
  emptyDescription = '先打开知识库或导入资料，这里才会出现可阅读和做笔记的内容。',
}: DocumentListPaneProps) {
  return (
    <aside className="w-72 shrink-0 border-r border-white/10 bg-black/20">
      <div className="border-b border-white/10 px-4 py-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">当前资料</div>
        <h2 className="mt-2 text-lg font-semibold text-white">围绕当前资料阅读和记笔记</h2>
      </div>
      <ScrollArea className="h-[calc(100vh-9rem)]">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <div className="p-4">
            <div className="rounded-[1.1rem] border border-dashed border-white/10 bg-white/4 px-4 py-5 text-sm leading-7 text-slate-400">
              <div className="font-medium text-slate-200">{emptyTitle}</div>
              <div className="mt-2">{emptyDescription}</div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 p-3">
            {documents.map((doc) => {
              const active = selectedDocument?.id === doc.id;
              return (
                <button
                  key={doc.id}
                  onClick={() => onSelect(doc)}
                  className={`w-full rounded-[1.1rem] border px-3 py-3 text-left transition ${
                    active
                      ? 'border-amber-200/40 bg-amber-200/12'
                      : 'border-white/8 bg-white/4 hover:border-white/16 hover:bg-white/6'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                    <div className="truncate text-sm font-medium text-white">{doc.title}</div>
                  </div>
                  <div className="mt-2 line-clamp-2 text-xs leading-6 text-slate-400">{doc.content}</div>
                  {doc.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {doc.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-slate-300">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}

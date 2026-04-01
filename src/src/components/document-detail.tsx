import { Hash, X, ExternalLink, Calendar, Tag, Loader2, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useKbStore } from '@/store/kb-store';

export function DocumentDetailPanel() {
  const { selectedDocument, detailLoading, closeDocument } = useKbStore();

  if (!selectedDocument && !detailLoading) return null;

  return (
    <div className="w-[420px] border-l bg-card/95 backdrop-blur-sm flex flex-col shrink-0 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 shrink-0 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-primary shrink-0" strokeWidth={1.5} />
          <span className="text-sm font-medium truncate">Source Detail</span>
        </div>
        <button
          onClick={closeDocument}
          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {detailLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : selectedDocument ? (
        <ScrollArea className="flex-1">
          <div className="p-4">
            {/* Title */}
            <h2 className="text-base font-semibold leading-tight mb-4">
              {selectedDocument.title || '(untitled)'}
            </h2>

            {/* Metadata */}
            <div className="space-y-2.5 mb-5">
              {selectedDocument.created_at && (
                <MetaRow icon={<Calendar className="h-3 w-3" />} label="Added" value={selectedDocument.created_at} />
              )}
              {selectedDocument.source && (
                <MetaRow icon={<ExternalLink className="h-3 w-3" />} label="Source" value={selectedDocument.source} />
              )}
              <MetaRow icon={<Tag className="h-3 w-3" />} label="ID" value={selectedDocument.id} />
            </div>

            {/* Tags */}
            {selectedDocument.tags.length > 0 && (
              <div className="mb-5">
                <div className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-2">Tags</div>
                <div className="flex gap-1.5 flex-wrap">
                  {selectedDocument.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-[11px] text-primary bg-primary/8 px-2 py-0.5 rounded-md font-medium"
                    >
                      <Hash className="h-2.5 w-2.5" />{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Score */}
            {selectedDocument.score > 0 && (
              <div className="mb-5">
                <div className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1">Relevance</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(selectedDocument.score * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{selectedDocument.score.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="h-px bg-border/50 mb-5" />

            {/* Content */}
            <div>
              <div className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-2">Content</div>
              <div className="text-[13px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
                {selectedDocument.content}
              </div>
            </div>
          </div>
        </ScrollArea>
      ) : null}
    </div>
  );
}

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-[12px]">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <span className="text-muted-foreground/60">{label}: </span>
        <span className="text-foreground/80 break-all">{value}</span>
      </div>
    </div>
  );
}

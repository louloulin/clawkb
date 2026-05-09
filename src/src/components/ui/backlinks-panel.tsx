import { useState, useEffect } from 'react';
import { Link2, ChevronRight, Loader2 } from 'lucide-react';
import { api } from '@/api/commands';

interface BacklinkEntry {
  note_id: string;
  note_title: string;
  context_snippet: string;
}

interface BacklinksPanelProps {
  noteId: string;
  onNavigate?: (noteId: string, title: string, snippet: string) => void;
}

/**
 * Reusable backlinks panel — shows notes that reference the current note.
 * Used in both the Editor page and Reader page.
 */
export function BacklinksPanel({ noteId, onNavigate }: BacklinksPanelProps) {
  const [backlinks, setBacklinks] = useState<BacklinkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.listBacklinks(noteId)
      .then((result) => { if (!cancelled) setBacklinks(result); })
      .catch(() => { if (!cancelled) setBacklinks([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [noteId]);

  if (loading) {
    return (
      <div className="mt-8 border-t border-border pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          查找反向链接…
        </div>
      </div>
    );
  }

  if (backlinks.length === 0) {
    return (
      <div className="mt-8 border-t border-border pt-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" />
          反向链接
        </div>
        <p className="mt-2 text-xs text-muted-foreground">暂无笔记引用此文档。</p>
      </div>
    );
  }

  return (
    <div className="mt-8 border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition"
      >
        <Link2 className="h-3.5 w-3.5" />
        反向链接 ({backlinks.length})
        <ChevronRight className={`h-3 w-3 transition ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="mt-3 grid gap-2">
          {backlinks.map((bl) => (
            <button
              key={bl.note_id}
              type="button"
              className="rounded-xl border border-border bg-card/60 p-3 text-left transition hover:border-primary/30 hover:bg-card"
              onClick={() => onNavigate?.(bl.note_id, bl.note_title, bl.context_snippet)}
            >
              <div className="text-sm font-medium text-foreground">{bl.note_title}</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground line-clamp-2">{bl.context_snippet}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

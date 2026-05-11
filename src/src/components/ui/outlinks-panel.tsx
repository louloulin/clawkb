import { useEffect, useMemo, useState } from 'react';
import { Link, ChevronRight, Loader2 } from 'lucide-react';
import { api } from '@/api/commands';

interface OutlinkEntry {
  noteId: string;
  noteTitle: string;
}

interface OutlinksPanelProps {
  noteId: string;
  onNavigate?: (noteId: string, title: string) => void;
}

/**
 * Reusable outlinks panel — shows notes that the current note links to (from [[...]] extraction).
 * Used in both the Editor page and Reader page.
 */
export function OutlinksPanel({ noteId, onNavigate }: OutlinksPanelProps) {
  const [outlinks, setOutlinks] = useState<OutlinkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const record = await api.getNoteRecord(noteId);
        const ids = (record?.outlinks ?? []).filter(Boolean);
        if (ids.length === 0) {
          if (!cancelled) setOutlinks([]);
          return;
        }

        const notes = await Promise.all(
          ids.map(async (id) => {
            try {
              const note = await api.getNote(id);
              return { noteId: note.id, noteTitle: note.title || id } satisfies OutlinkEntry;
            } catch {
              return { noteId: id, noteTitle: id } satisfies OutlinkEntry;
            }
          }),
        );
        if (!cancelled) setOutlinks(notes);
      } catch {
        if (!cancelled) setOutlinks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [noteId]);

  const count = outlinks.length;
  const hasOutlinks = count > 0;

  const headerLabel = useMemo(() => (
    hasOutlinks ? `出链 (${count})` : '出链'
  ), [hasOutlinks, count]);

  if (loading) {
    return (
      <div className="mt-8 border-t border-border pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          查找出链…
        </div>
      </div>
    );
  }

  if (!hasOutlinks) {
    return (
      <div className="mt-8 border-t border-border pt-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
          <Link className="h-3.5 w-3.5" />
          {headerLabel}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">暂无链接到其他笔记。</p>
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
        <Link className="h-3.5 w-3.5" />
        {headerLabel}
        <ChevronRight className={`h-3 w-3 transition ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="mt-3 grid gap-2">
          {outlinks.map((ol) => (
            <button
              key={ol.noteId}
              type="button"
              className="rounded-xl border border-border bg-card/60 p-3 text-left transition hover:border-primary/30 hover:bg-card"
              onClick={() => onNavigate?.(ol.noteId, ol.noteTitle)}
            >
              <div className="text-sm font-medium text-foreground">{ol.noteTitle}</div>
              <div className="mt-1 text-[11px] leading-5 text-muted-foreground">[[{ol.noteTitle}]]</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


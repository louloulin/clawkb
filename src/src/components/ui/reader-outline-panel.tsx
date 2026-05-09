import { useState, useEffect, useCallback } from 'react';
import { List, FileText, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/api/commands';

interface OutlineNode {
  level: number;
  text: string;
  position: number;
}

interface OutlinePanelProps {
  noteId: string;
}

export function OutlinePanel({ noteId }: OutlinePanelProps) {
  const [nodes, setNodes] = useState<OutlineNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Get the note record to extract outline from content
    api.getNoteRecord(noteId)
      .then((note) => {
        if (cancelled) return;
        if (!note) { setNodes([]); return; }
        const extracted = extractOutlineFromContent(note.content);
        setNodes(extracted);
      })
      .catch(() => { if (!cancelled) setNodes([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [noteId]);

  const handleJumpTo = useCallback((pos: number) => {
    // Dispatch a custom event that the reader scroll area can listen for
    const scrollable = document.querySelector('.flex.flex-1.overflow-auto');
    if (scrollable instanceof HTMLElement) {
      scrollable.scrollTop = pos;
    }
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground/80">
            <List className="h-3.5 w-3.5" />
            大纲
          </div>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground/80">
          <List className="h-3.5 w-3.5" />
          大纲
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-muted-foreground hover:text-white transition"
        >
          {expanded ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {expanded && (
        <ScrollArea className="flex-1 px-3 py-3">
          {nodes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <FileText className="h-6 w-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">文档中无标题</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {nodes.map((node, i) => (
                <button
                  key={i}
                  onClick={() => handleJumpTo(node.position)}
                  className="w-full flex items-center gap-1.5 rounded-lg text-left text-[12px] leading-5 text-muted-foreground hover:bg-white/6 hover:text-white transition px-2 py-1.5"
                  style={{ paddingLeft: `${(node.level - 1) * 12 + 8}px` }}
                >
                  <span className="text-[10px] text-muted-foreground/70 shrink-0">H{node.level}</span>
                  <span className="truncate">{node.text}</span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      )}

      {nodes.length > 0 && (
        <div className="border-t border-white/10 px-4 py-2 text-[10px] text-muted-foreground">
          {nodes.filter(n => n.level === 1).length} 章 · {nodes.length} 节
        </div>
      )}
    </div>
  );
}

/** Extract headings from markdown content */
function extractOutlineFromContent(content: string): OutlineNode[] {
  const nodes: OutlineNode[] = [];
  let charPos = 0;
  for (const line of content.split('\n')) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('#')) {
      let level = 0;
      let pos = 0;
      for (const ch of trimmed) {
        if (ch === '#') { level++; pos++; }
        else break;
      }
      if (level > 0 && level <= 6) {
        const text = trimmed.slice(pos).trim();
        if (text) {
          nodes.push({ level, text, position: charPos });
        }
      }
    }
    charPos += line.length + 1;
  }
  return nodes;
}

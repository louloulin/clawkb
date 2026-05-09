import { useMemo, useCallback, useState } from 'react';
import { ChevronRight, List, FileText, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Editor } from '@tiptap/react';

export interface OutlineNode {
  id: string;
  level: number;
  text: string;
  pos: number;
}

interface OutlinePanelProps {
  editor: Editor | null;
  open: boolean;
  onClose: () => void;
}

export function extractOutline(editor: Editor | null): OutlineNode[] {
  if (!editor) return [];

  const nodes: OutlineNode[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const text = node.textContent;
      if (text.trim()) {
        nodes.push({
          id: `h-${pos}`,
          level: node.attrs.level as number,
          text,
          pos,
        });
      }
    }
  });
  return nodes;
}

export function OutlinePanel({ editor, open, onClose }: OutlinePanelProps) {
  const outline = useMemo(() => extractOutline(editor), [editor?.state.doc]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  const scrollToHeading = useCallback(
    (pos: number) => {
      if (!editor) return;
      editor.commands.setTextSelection(pos);
      editor.commands.scrollIntoView();
    },
    [editor],
  );

  // Move heading at fromIdx to toIdx position in the document
  const handleDrop = useCallback(
    (fromIdx: number, toIdx: number) => {
      if (!editor || fromIdx === toIdx) return;

      const fromNode = outline[fromIdx];
      const toNode = outline[toIdx];
      if (!fromNode || !toNode) return;

      // Find the range of content under fromNode (from this heading to the next heading of same or higher level)
      const nextHeadingIdx = outline.findIndex(
        (n, i) => i > fromIdx && n.level <= fromNode.level,
      );
      const fromEnd = nextHeadingIdx > 0
        ? outline[nextHeadingIdx].pos - 1
        : editor.state.doc.content.size;

      // Extract the content block
      const slice = editor.state.doc.slice(fromNode.pos, fromEnd);
      const tr = editor.state.tr;

      // Delete from original position
      const deleteFrom = fromNode.pos;
      const deleteTo = fromEnd;
      tr.delete(deleteFrom, deleteTo);

      // Insert at target position (adjust for deletion)
      const adjustedPos = toIdx > fromIdx
        ? toNode.pos - (fromEnd - fromNode.pos)
        : toNode.pos;

      tr.insert(adjustedPos, slice.content);
      editor.view.dispatch(tr);

      setDragIdx(null);
      setDropIdx(null);
    },
    [editor, outline],
  );

  if (!open) return null;

  const maxLevel = outline.length > 0 ? Math.max(...outline.map((n) => n.level)) : 3;

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-l border-white/10 bg-secondary backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground/80">
          <List className="h-3.5 w-3.5" />
          文档大纲
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-6 w-6 rounded-md text-muted-foreground hover:bg-white/6 hover:text-white"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3 py-3">
        {outline.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <FileText className="h-6 w-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">添加标题后会自动生成大纲</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {outline.map((node, i) => {
              const indent = ((node.level - 1) / (maxLevel - 1 || 1)) * 12;
              const isDragging = dragIdx === i;
              const isDropTarget = dropIdx === i;
              return (
                <div
                  key={node.id}
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={(e) => { e.preventDefault(); setDropIdx(i); }}
                  onDragLeave={() => setDropIdx(null)}
                  onDrop={() => { if (dragIdx !== null) handleDrop(dragIdx, i); }}
                  onDragEnd={() => { setDragIdx(null); setDropIdx(null); }}
                  className={`flex items-center gap-1 rounded-lg text-left text-[12px] leading-5 transition ${
                    isDragging
                      ? 'opacity-40 bg-white/4'
                      : isDropTarget
                        ? 'bg-primary/10 ring-1 ring-primary/30'
                        : 'text-muted-foreground hover:bg-white/6 hover:text-white'
                  }`}
                  style={{ paddingLeft: `${8 + indent}px` }}
                >
                  <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/70 cursor-grab" />
                  <button
                    onClick={() => scrollToHeading(node.pos)}
                    className="flex-1 py-1.5 text-left"
                  >
                    <span className="mr-1.5 text-[10px] text-muted-foreground">H{node.level}</span>
                    <span className="line-clamp-2">{node.text}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {outline.length > 0 && (
        <div className="border-t border-white/10 px-4 py-2 text-[10px] text-muted-foreground">
          {outline.filter((n) => n.level === 1).length} 个章节 · {outline.length} 个标题 · 拖拽可排序
        </div>
      )}
    </div>
  );
}

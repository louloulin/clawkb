import { useMemo, useCallback } from 'react';
import { ChevronRight, List, FileText } from 'lucide-react';
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

  const scrollToHeading = useCallback(
    (pos: number) => {
      if (!editor) return;
      editor.commands.setTextSelection(pos);
      editor.commands.scrollIntoView();
    },
    [editor],
  );

  if (!open) return null;

  const maxLevel = outline.length > 0 ? Math.max(...outline.map((n) => n.level)) : 3;

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-l border-white/10 bg-black/20 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
          <List className="h-3.5 w-3.5" />
          文档大纲
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-6 w-6 rounded-md text-slate-400 hover:bg-white/6 hover:text-white"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3 py-3">
        {outline.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <FileText className="h-6 w-6 text-slate-500" />
            <p className="text-xs text-slate-500">添加标题后会自动生成大纲</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {outline.map((node) => {
              const indent = ((node.level - 1) / (maxLevel - 1 || 1)) * 12;
              return (
                <button
                  key={node.id}
                  onClick={() => scrollToHeading(node.pos)}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-[12px] leading-5 text-slate-400 transition hover:bg-white/6 hover:text-white"
                  style={{ paddingLeft: `${8 + indent}px` }}
                >
                  <span className="mr-1.5 text-[10px] text-slate-500">H{node.level}</span>
                  <span className="line-clamp-2">{node.text}</span>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {outline.length > 0 && (
        <div className="border-t border-white/10 px-4 py-2 text-[10px] text-slate-500">
          {outline.filter((n) => n.level === 1).length} 个章节 · {outline.length} 个标题
        </div>
      )}
    </div>
  );
}

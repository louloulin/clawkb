import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
});

function MermaidNodeView({ node }: { node: { attrs: { code: string } }; updateAttributes: (attrs: Record<string, string>) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !node.attrs.code) return;
    const render = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        const { svg } = await mermaid.render(id, node.attrs.code);
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Mermaid render error');
      }
    };
    render();
  }, [node.attrs.code]);

  return (
    <NodeViewWrapper>
      <div className="my-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Mermaid</span>
        </div>
        {error ? (
          <div className="text-xs text-red-400 p-2 bg-red-500/10 rounded">{error}</div>
        ) : (
          <div ref={containerRef} className="flex justify-center [&>svg]:max-w-full" />
        )}
        <pre className="mt-2 text-[11px] text-muted-foreground bg-background/50 rounded p-2 overflow-x-auto">
          {node.attrs.code}
        </pre>
      </div>
    </NodeViewWrapper>
  );
}

export const MermaidBlock = Node.create({
  name: 'mermaid',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      code: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-code') || '',
        renderHTML: (attrs) => ({ 'data-code': attrs.code }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-mermaid]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-mermaid': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView);
  },

  addCommands() {
    return {
      insertMermaid:
        (code = 'graph TD\n  A[Start] --> B[End]') =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { code },
          });
        },
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaid: {
      insertMermaid: (code?: string) => ReturnType;
    };
  }
}

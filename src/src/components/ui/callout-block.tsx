import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { AlertTriangle, Info, CheckCircle, XCircle, Lightbulb } from 'lucide-react';

type CalloutType = 'info' | 'warning' | 'success' | 'danger' | 'tip';

const CALLOUT_STYLES: Record<CalloutType, { icon: typeof Info; bg: string; border: string; iconColor: string; label: string }> = {
  info:    { icon: Info,         bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    iconColor: 'text-blue-400',    label: 'ℹ️' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-500/10', border: 'border-amber-500/30',   iconColor: 'text-amber-400',   label: '⚠️' },
  success: { icon: CheckCircle,  bg: 'bg-green-500/10',  border: 'border-green-500/30',   iconColor: 'text-green-400',   label: '✅' },
  danger:  { icon: XCircle,      bg: 'bg-red-500/10',    border: 'border-red-500/30',     iconColor: 'text-red-400',     label: '❌' },
  tip:     { icon: Lightbulb,    bg: 'bg-purple-500/10', border: 'border-purple-500/30',  iconColor: 'text-purple-400',  label: '💡' },
};

function CalloutNodeView({ node, updateAttributes }: { node: { attrs: { type: CalloutType } }; updateAttributes: (attrs: Record<string, string>) => void }) {
  const calloutType = node.attrs.type || 'info';
  const style = CALLOUT_STYLES[calloutType] || CALLOUT_STYLES.info;
  const Icon = style.icon;

  return (
    <NodeViewWrapper>
      <div className={`my-2 flex gap-3 rounded-lg border p-3 ${style.bg} ${style.border}`}>
        <div className="shrink-0 pt-0.5">
          <Icon className={`h-5 w-5 ${style.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-foreground" contentEditable suppressContentEditableWarning />
        </div>
        <select
          value={calloutType}
          onChange={(e) => updateAttributes({ type: e.target.value })}
          className="shrink-0 bg-transparent text-xs text-muted-foreground border border-border rounded px-1 py-0.5 outline-none"
          contentEditable={false}
        >
          {Object.entries(CALLOUT_STYLES).map(([key, s]) => (
            <option key={key} value={key}>{s.label} {key}</option>
          ))}
        </select>
      </div>
    </NodeViewWrapper>
  );
}

export const CalloutBlock = Node.create({
  name: 'callout',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: (el) => el.getAttribute('data-type') || 'info',
        renderHTML: (attrs) => ({ 'data-type': attrs.type }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView);
  },

  addCommands() {
    return {
      setCallout:
        (type: CalloutType = 'info') =>
        ({ commands }) => {
          return commands.wrapIn(this.name, { type });
        },
      unsetCallout:
        () =>
        ({ commands }) => {
          return commands.lift(this.name);
        },
      toggleCallout:
        (type: CalloutType = 'info') =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, { type });
        },
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (type?: CalloutType) => ReturnType;
      unsetCallout: () => ReturnType;
      toggleCallout: (type?: CalloutType) => ReturnType;
    };
  }
}

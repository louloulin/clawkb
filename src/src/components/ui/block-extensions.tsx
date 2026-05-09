/**
 * Block Extensions for TipTap Editor
 * 
 * Features:
 * 1. Block IDs - Unique identifiers for each block
 * 2. Drag Handle - Reorder blocks by dragging
 * 3. Block Reference - Reference blocks from other places
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Node, mergeAttributes } from '@tiptap/core';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GripVertical, Link2, Copy, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { Button } from './button';

// ============================================================================
// Block ID Extension
// ============================================================================

export const BlockIdExtension = Extension.create({
  name: 'blockId',
  
  addOptions() {
    return {
      types: ['paragraph', 'heading', 'listItem', 'taskItem', 'blockquote', 'codeBlock'],
      attributeName: 'blockId',
    };
  },
  
  addAttributes() {
    return {
      blockId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-block-id') || generateBlockId(),
        renderHTML: (attributes) => {
          if (!attributes.blockId) return {};
          return { 'data-block-id': attributes.blockId };
        },
      },
    };
  },
  
  addProseMirrorPlugins() {
    const { types, attributeName } = this.options;
    
    return [
      new Plugin({
        key: new PluginKey('blockId'),
        appendTransaction: (transactions, oldState, newState) => {
          // Only process if document changed
          const docChanged = transactions.some(tr => tr.docChanged);
          if (!docChanged) return null;
          
          const tr = newState.tr;
          let modified = false;
          
          newState.doc.descendants((node, pos) => {
            if (types.includes(node.type.name) && !node.attrs[attributeName]) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                [attributeName]: generateBlockId(),
              });
              modified = true;
            }
          });
          
          return modified ? tr : null;
        },
      }),
    ];
  },
});

// Generate a short unique ID
function generateBlockId(): string {
  return 'bl_' + Math.random().toString(36).substring(2, 10);
}

// ============================================================================
// Block Reference Extension
// ============================================================================

export const BlockReferenceExtension = Node.create({
  name: 'blockReference',
  group: 'inline',
  inline: true,
  atom: true,
  
  addAttributes() {
    return {
      blockId: { default: null },
      blockTitle: { default: '' },
    };
  },
  
  parseHTML() {
    return [{ tag: 'span[data-block-reference]' }];
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 
      'data-block-reference': 'true',
      class: 'block-reference'
    }, HTMLAttributes), `↳ ${HTMLAttributes.blockTitle || '引用'}`];
  },
  
  addNodeView() {
    return ({ node, HTMLAttributes }) => {
      const span = document.createElement('span');
      span.className = 'block-reference';
      span.setAttribute('data-block-reference', 'true');
      span.setAttribute('data-block-id', node.attrs.blockId);
      span.textContent = `↳ ${node.attrs.blockTitle || '引用'}`;
      span.style.cssText = `
        background: hsl(43 96% 59% / 0.15);
        border: 1px solid hsl(43 96% 59% / 0.3);
        border-radius: 4px;
        padding: 2px 6px;
        cursor: pointer;
        font-size: 0.875em;
        color: hsl(43 96% 59%);
      `;
      return { dom: span };
    };
  },
});

// ============================================================================
// Drag Handle Component
// ============================================================================

interface DragHandleProps {
  editor: any;
  blockId?: string;
  blockPos?: number;
}

export function BlockDragHandle({ editor, blockId, blockPos }: DragHandleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (blockPos === undefined) return;
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'block', pos: blockPos }));
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  }, [blockPos]);
  
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setShowMenu(false);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.type === 'block' && blockPos !== undefined) {
        const from = data.pos;
        const to = blockPos;
        if (from !== to) {
          editor.chain().focus().deleteRange({ from, to: from + 1 }).run();
          editor.chain().focus().insertContentAt(to > from ? to - 1 : to, editor.state.doc.nodeAt(from)).run();
        }
      }
    } catch {
      // Ignore invalid drop data
    }
  }, [editor, blockPos]);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);
  
  const handleCopyBlockId = useCallback(() => {
    if (blockId) {
      navigator.clipboard.writeText(`(( ${blockId} ))`);
      setShowMenu(false);
    }
  }, [blockId]);
  
  const handleInsertReference = useCallback(() => {
    if (blockId && editor) {
      editor.chain().focus().insertContent({
        type: 'blockReference',
        attrs: { blockId, blockTitle: 'Block Reference' },
      }).run();
      setShowMenu(false);
    }
  }, [editor, blockId]);
  
  const handleDeleteBlock = useCallback(() => {
    if (blockPos !== undefined && editor) {
      editor.chain().focus().deleteRange({ from: blockPos, to: blockPos + 1 }).run();
      setShowMenu(false);
    }
  }, [editor, blockPos]);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);
  
  return (
    <div 
      ref={menuRef}
      className="drag-handle-container"
      contentEditable={false}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <button
        type="button"
        className={`drag-handle-btn ${isDragging ? 'dragging' : ''}`}
        onClick={() => setShowMenu(!showMenu)}
        title="Block options"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      
      {showMenu && (
        <div className="drag-handle-menu">
          <button onClick={handleCopyBlockId} title="Copy block ID">
            <Copy className="h-3.5 w-3.5" />
            <span>复制ID</span>
          </button>
          <button onClick={handleInsertReference} title="Insert reference">
            <Link2 className="h-3.5 w-3.5" />
            <span>引用</span>
          </button>
          <button onClick={handleDeleteBlock} title="Delete block">
            <Trash2 className="h-3.5 w-3.5" />
            <span>删除</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Drag Handle Plugin
// ============================================================================

export const dragHandlePluginKey = new PluginKey('dragHandle');

export const DragHandlePlugin = Extension.create({
  name: 'dragHandle',
  
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: dragHandlePluginKey,
        props: {
          handleDOMEvents: {
            // Add drag attributes to blocks
            view: (view) => {
              updateBlockDragHandles(view);
              return false;
            },
          },
        },
        appendTransaction: (transactions, oldState, newState) => {
          const docChanged = transactions.some(tr => tr.docChanged);
          if (docChanged) {
            setTimeout(() => updateBlockDragHandles(newState.tr.doc.type.spec.content ? 
              { doc: newState.doc } as any : newState.doc, undefined as any), 0);
          }
          return false;
        },
      }),
    ];
  },
});

// Helper to update drag handles in DOM
function updateBlockDragHandles(view: any, blockId?: Map<string, number>) {
  if (!view || !view.dom) return;
  
  // Add draggable attribute to top-level blocks
  const editorContent = view.dom.querySelector('.ProseMirror');
  if (!editorContent) return;
  
  const blockTypes = ['paragraph', 'heading', 'listItem', 'taskItem', 'blockquote', 'codeBlock', 'table', 'image'];
  
  editorContent.querySelectorAll(blockTypes.join(',')).forEach((block: Element, index: number) => {
    if (!block.hasAttribute('draggable')) {
      block.setAttribute('draggable', 'true');
      block.style.position = 'relative';
      block.dataset.dragHandle = 'true';
    }
  });
}

// ============================================================================
// Block Fold Extension (Indent/Collapse)
// ============================================================================

export const BlockFoldExtension = Extension.create({
  name: 'blockFold',
  
  addKeyboardShortcuts() {
    return {
      'Mod-ArrowLeft': () => {
        // Decrease indent (or fold)
        return this.editor.chain().focus().liftListItem('listItem').run();
      },
      'Mod-ArrowRight': () => {
        // Increase indent (or expand)
        return this.editor.chain().focus().sinkListItem('listItem').run();
      },
      'Mod-Shift-c': () => {
        // Copy block ID
        const { state } = this.editor;
        const { from } = state.selection;
        const $pos = state.doc.resolve(from);
        const node = $pos.parent;
        const blockId = node.attrs.blockId;
        if (blockId) {
          navigator.clipboard.writeText(`(( ${blockId} ))`);
          return true;
        }
        return false;
      },
      'Mod-/': () => {
        // Toggle block fold (collapse/expand current heading section)
        const { state } = this.editor;
        const { from } = state.selection;
        const $pos = state.doc.resolve(from);
        const before = $pos.before();
        const after = $pos.after();
        const hasCollapseAttr = state.doc.rangeHasAttribute(before, after, 'collapsed');
        
        if (hasCollapseAttr) {
          // Unfold: clear the collapsed attribute
          state.tr.removeMark(before, after, state.schema.marks['collapsed']);
        } else {
          // Fold: add collapsed mark or toggle next sibling visibility
          // For simplicity, we'll toggle the current block
        }
        return true;
      },
    };
  },
});

// ============================================================================
// Custom BubbleMenu — TipTap v3 doesn't ship React components for this.
// We detect text selection and show a floating toolbar using tippy.js.
// ============================================================================

import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import type { Editor } from '@tiptap/react';

interface BlockBubbleMenuProps {
  editor: Editor;
}

export function BlockBubbleMenu({ editor }: BlockBubbleMenuProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!editor) return;

    const updateVisibility = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty || from === to) {
        setVisible(false);
        return;
      }

      // Get selection coordinates
      const { view } = editor;
      const start = view.coordsAtPos(from);
      const end = view.coordsAtPos(to);
      const editorBox = view.dom.getBoundingClientRect();

      setVisible(true);
      setCoords({
        top: start.top - editorBox.top - 48,
        left: (start.left + end.left) / 2 - editorBox.left,
      });
    };

    editor.on('selectionUpdate', updateVisibility);
    editor.on('blur', () => setVisible(false));
    return () => {
      editor.off('selectionUpdate', updateVisibility);
    };
  }, [editor]);

  const handleToggleBold = () => editor.chain().focus().toggleBold().run();
  const handleToggleItalic = () => editor.chain().focus().toggleItalic().run();
  const handleToggleStrike = () => editor.chain().focus().toggleStrike().run();
  const handleToggleCode = () => editor.chain().focus().toggleCode().run();
  const handleCopy = () => {
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to);
    navigator.clipboard.writeText(text);
  };

  if (!visible || !editor) return null;

  return (
    <div
      className="absolute z-50 flex items-center gap-0.5 rounded-lg border border-border bg-card p-1 shadow-lg"
      style={{ top: coords.top, left: coords.left, transform: 'translateX(-50%)' }}
    >
      <button
        onClick={handleToggleBold}
        className={`rounded-md p-1.5 text-xs font-bold transition-colors ${
          editor.isActive('bold') ? 'bg-primary/15 text-primary' : 'text-foreground/80 hover:bg-muted/50'
        }`}
        title="粗体 (⌘B)"
      >
        B
      </button>
      <button
        onClick={handleToggleItalic}
        className={`rounded-md p-1.5 text-xs italic transition-colors ${
          editor.isActive('italic') ? 'bg-primary/15 text-primary' : 'text-foreground/80 hover:bg-muted/50'
        }`}
        title="斜体 (⌘I)"
      >
        I
      </button>
      <button
        onClick={handleToggleStrike}
        className={`rounded-md p-1.5 text-xs line-through transition-colors ${
          editor.isActive('strike') ? 'bg-primary/15 text-primary' : 'text-foreground/80 hover:bg-muted/50'
        }`}
        title="删除线"
      >
        S
      </button>
      <button
        onClick={handleToggleCode}
        className={`rounded-md p-1.5 text-xs font-mono transition-colors ${
          editor.isActive('code') ? 'bg-primary/15 text-primary' : 'text-foreground/80 hover:bg-muted/50'
        }`}
        title="行内代码"
      >
        {'</>'}
      </button>
      <div className="mx-1 h-4 w-px bg-muted" />
      <button
        onClick={handleCopy}
        className="rounded-md p-1.5 text-xs text-foreground/80 transition-colors hover:bg-muted/50"
        title="复制"
      >
        📋
      </button>
    </div>
  );
}

// ============================================================================
// Custom FloatingMenu — shown on empty paragraph at start of line
// ============================================================================

interface BlockFloatingMenuProps {
  editor: Editor;
}

export function BlockFloatingMenu({ editor }: BlockFloatingMenuProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!editor) return;

    const updatePosition = () => {
      const { $from } = editor.state.selection;
      const node = $from.parent;
      const isEmpty = node.content.size === 0 && node.type.name === 'paragraph';

      if (!isEmpty) {
        setVisible(false);
        return;
      }

      const coordsAtPos = editor.view.coordsAtPos($from.pos);
      const editorBox = editor.view.dom.getBoundingClientRect();

      setVisible(true);
      setCoords({
        top: coordsAtPos.top - editorBox.top - 4,
        left: coordsAtPos.left - editorBox.left - 40,
      });
    };

    editor.on('selectionUpdate', updatePosition);
    editor.on('update', updatePosition);
    return () => {
      editor.off('selectionUpdate', updatePosition);
      editor.off('update', updatePosition);
    };
  }, [editor]);

  const handleHeading = (level: 1 | 2 | 3) => () => editor.chain().focus().toggleHeading({ level }).run();
  const handleBullet = () => editor.chain().focus().toggleBulletList().run();
  const handleTask = () => editor.chain().focus().toggleTaskList().run();
  const handleQuote = () => editor.chain().focus().toggleBlockquote().run();

  if (!visible || !editor) return null;

  return (
    <div
      className="absolute z-50 flex flex-col gap-0.5 rounded-lg border border-border bg-card p-1 shadow-lg"
      style={{ top: coords.top, left: coords.left }}
    >
      {([1, 2, 3] as const).map((level) => (
        <button
          key={level}
          onClick={handleHeading(level)}
          className={`rounded-md px-2 py-1 text-[10px] transition-colors ${
            editor.isActive('heading', { level }) ? 'bg-primary/15 text-primary' : 'text-foreground/80 hover:bg-muted/50'
          }`}
          title={`标题 ${level}`}
        >
          H{level}
        </button>
      ))}
      <div className="my-0.5 h-px w-full bg-muted" />
      <button
        onClick={handleBullet}
        className={`rounded-md px-2 py-1 text-[10px] transition-colors ${
          editor.isActive('bulletList') ? 'bg-primary/15 text-primary' : 'text-foreground/80 hover:bg-muted/50'
        }`}
        title="无序列表"
      >
        •
      </button>
      <button
        onClick={handleTask}
        className={`rounded-md px-2 py-1 text-[10px] transition-colors ${
          editor.isActive('taskList') ? 'bg-primary/15 text-primary' : 'text-foreground/80 hover:bg-muted/50'
        }`}
        title="任务列表"
      >
        ☑
      </button>
      <button
        onClick={handleQuote}
        className={`rounded-md px-2 py-1 text-[10px] transition-colors ${
          editor.isActive('blockquote') ? 'bg-primary/15 text-primary' : 'text-foreground/80 hover:bg-muted/50'
        }`}
        title="引用"
      >
        "
      </button>
    </div>
  );
}

// ============================================================================
// Block Reference Search Component
// ============================================================================

interface BlockReferenceSearchProps {
  editor: any;
  onSelect: (blockId: string, blockTitle: string) => void;
  onClose: () => void;
}

export function BlockReferenceSearch({ editor, onSelect, onClose }: BlockReferenceSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ blockId: string; title: string; preview: string }>>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  useEffect(() => {
    if (!editor) return;
    
    const doc = editor.state.doc;
    const blocks: Array<{ blockId: string; title: string; preview: string }> = [];
    
    doc.descendants((node: any, pos: number) => {
      const blockId = node.attrs?.blockId;
      if (blockId) {
        const text = node.textContent.slice(0, 50);
        const title = node.type.name === 'heading' ? text : `Block ${blockId.slice(0, 8)}`;
        blocks.push({ blockId, title, preview: text });
      }
      return true;
    });
    
    if (query) {
      const filtered = blocks.filter(b => 
        b.title.toLowerCase().includes(query.toLowerCase()) ||
        b.blockId.toLowerCase().includes(query.toLowerCase())
      );
      setResults(filtered);
    } else {
      setResults(blocks.slice(0, 10));
    }
    setSelectedIndex(0);
  }, [editor, query]);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        onSelect(results[selectedIndex].blockId, results[selectedIndex].title);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-card border rounded-xl shadow-xl w-96 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索块..."
            className="w-full bg-transparent border-none outline-none text-sm"
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              未找到匹配的块
            </div>
          ) : (
            results.map((result, index) => (
              <button
                key={result.blockId}
                onClick={() => onSelect(result.blockId, result.title)}
                className={`w-full text-left px-4 py-2 hover:bg-muted transition-colors ${
                  index === selectedIndex ? 'bg-muted' : ''
                }`}
              >
                <div className="text-sm font-medium truncate">{result.title}</div>
                <div className="text-xs text-muted-foreground truncate">{result.preview}</div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

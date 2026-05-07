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
        background: rgba(245, 158, 11, 0.15);
        border: 1px solid rgba(245, 158, 11, 0.3);
        border-radius: 4px;
        padding: 2px 6px;
        cursor: pointer;
        font-size: 0.875em;
        color: #fbbf24;
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
    };
  },
});

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

import { useEffect, useState, useRef, useCallback } from 'react';
import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { Editor } from '@tiptap/react';
import { api } from '@/api';

const wikilinkPluginKey = new PluginKey('wikilink-autocomplete');

export interface WikiLinkState {
  active: boolean;
  query: string;
  pos: number;
  from: number;
  to: number;
}

export function wikilinkPlugin(
  onOpen: (state: WikiLinkState) => void,
  onClose: () => void,
) {
  return new Plugin({
    key: wikilinkPluginKey,
    props: {
      handleTextInput(view: EditorView, from: number, to: number, text: string) {
        const { state } = view;
        const $from = state.doc.resolve(from);
        const textBefore = $from.parent.textContent.slice(
          Math.max(0, $from.parentOffset - 1),
          $from.parentOffset,
        );

        // Detect [[ (second [ typed right after first [)
        if (text === '[' && textBefore === '[') {
          onOpen({
            active: true,
            query: '',
            pos: to + 1,
            from: from - 1,
            to: to + 1,
          });
          return false;
        }

        onClose();
        return false;
      },
      handleKeyDown(view: EditorView, event: KeyboardEvent) {
        const pluginState = wikilinkPluginKey.getState(view.state) as WikiLinkState | undefined;
        if (!pluginState?.active) return false;

        if (event.key === 'Escape') {
          onClose();
          return true;
        }
        return false;
      },
    },
    state: {
      init() {
        return { active: false, query: '', pos: 0, from: 0, to: 0 };
      },
      apply(tr: any, prev: WikiLinkState) {
        return tr.getMeta(wikilinkPluginKey) ?? prev;
      },
    },
  });
}

interface WikiLinkAutocompleteProps {
  editor: Editor;
  state: WikiLinkState;
  onSelect: (noteTitle: string) => void;
  onClose: () => void;
  onQueryChange?: (query: string) => void;
}

export function WikiLinkAutocomplete({ editor, state, onSelect, onClose, onQueryChange }: WikiLinkAutocompleteProps) {
  const [results, setResults] = useState<Array<{ id: string; title: string; content?: string }>>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state.query) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const hits = await api.search(state.query, 8);
        setResults(hits.map(h => ({ id: h.id, title: h.title || '未命名笔记', content: h.content })));
        setSelectedIndex(0);
      } catch {
        setResults([]);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [state.query]);

  const insertLink = useCallback((noteTitle: string) => {
    if (!editor) return;
    const from = state.from;
    const to = editor.state.selection.from;
    const linkText = `[[${noteTitle}]]`;
    const newTr = editor.state.tr.insertText(linkText, from, to).setMeta(wikilinkPluginKey, { active: false });
    editor.view.dispatch(newTr);
    onSelect(noteTitle);
    onClose();
  }, [editor, state.from, onSelect, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        insertLink(results[selectedIndex].title);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [results, selectedIndex, insertLink, onClose]);

  // Position the dropdown near the cursor
  useEffect(() => {
    if (!editor?.view || !containerRef.current) return;
    const coords = editor.view.coordsAtPos(state.pos);
    const containerRect = editor.view.dom.getBoundingClientRect();
    const left = coords.left - containerRect.left;
    const top = coords.bottom - containerRect.top;
    containerRef.current.style.left = `${left}px`;
    containerRef.current.style.top = `${top}px`;
  }, [editor, state.pos]);

  const handleTextInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    onQueryChange?.(newQuery);
  };

  if (!state.active || !editor) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-[300] w-64 rounded-xl border border-white/10 bg-[rgba(10,12,18,0.95)] shadow-2xl overflow-hidden"
      style={{ left: 0, top: 0 }}
      onKeyDown={handleKeyDown}
    >
      <div className="p-2 border-b border-white/10">
        <input
          type="text"
          placeholder="搜索笔记..."
          autoFocus
          onChange={handleTextInput}
          className="w-full bg-transparent border-none outline-none text-sm text-white placeholder:text-slate-500"
        />
      </div>
      <div className="max-h-48 overflow-y-auto py-1">
        {results.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-4 px-2">
            输入关键词搜索笔记
          </div>
        ) : (
          results.map((r, i) => (
            <button
              key={r.id}
              onClick={() => insertLink(r.title)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                i === selectedIndex ? 'bg-amber-200/20 text-white' : 'hover:bg-white/6 text-slate-300'
              }`}
            >
              <div className="font-medium truncate">{r.title}</div>
              {r.content && (
                <div className="text-[11px] text-slate-500 truncate mt-0.5">{r.content.slice(0, 50)}</div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

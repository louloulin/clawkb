import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import {
  Bold, Italic, List, ListOrdered, Strikethrough, Code, Quote,
  Undo, Redo, Sparkles, Wand2, ChevronDown, Loader2, X, FileText, Save,
  Heading1, Heading2, Heading3, LinkIcon, Type, PanelRight, Minus,
  ListChecks, ToggleRight, BookOpen, Image as ImageIcon, LayoutGrid,
  CheckSquare, MessageSquare, ChevronRight, GitBranch
} from 'lucide-react';
import {
  BlockIdExtension,
  BlockReferenceExtension,
  BlockFoldExtension,
  BlockReferenceSearch,
  BlockBubbleMenu,
  BlockFloatingMenu,
} from '@/components/ui/block-extensions';
import { OutlinePanel } from '@/components/ui/outline-panel';
import { TemplateManager } from '@/components/ui/template-manager';
import { WikiLinkAutocomplete, wikilinkPlugin, type WikiLinkState } from '@/components/ui/wikilink-autocomplete';
import { CalloutBlock } from '@/components/ui/callout-block';
import { MermaidBlock } from '@/components/ui/mermaid-block';
import { LocalGraph } from '@/components/ui/local-graph';
import { getTemplates, type EditorTemplate } from '@/store/template-store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/api/commands';
import type { ContextFragment, SearchHit } from '@/api';
import { useToast } from '@/hooks/use-toast';
import { classifyAppError, userInputError } from '@/lib/app-error';

// AI command suggestions
const AI_COMMANDS = [
  { id: 'continue', label: '继续写作', icon: Wand2, prompt: 'Continue the following text in the same style and tone:' },
  { id: 'improve', label: '改善表达', icon: Sparkles, prompt: 'Improve the clarity and readability of:' },
  { id: 'shorten', label: '精简内容', icon: ChevronDown, prompt: 'Make this more concise while keeping the key points:' },
  { id: 'expand', label: '展开细节', icon: List, prompt: 'Expand on this with more details and examples:' },
  { id: 'fix', label: '修正语法', icon: Code, prompt: 'Fix any grammar or spelling errors in:' },
];

// Slash command options for block insertion (Notion-style)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SLASH_COMMAND_DEFS: Array<{ id: string; label: string; description: string; icon: any; category: string; transform?: string; actionType: string }> = [
  { id: 'heading1', label: '标题 1', description: '大标题', icon: Heading1, category: 'basic', actionType: 'toggleHeading1' },
  { id: 'heading2', label: '标题 2', description: '中标题', icon: Heading2, category: 'basic', actionType: 'toggleHeading2' },
  { id: 'heading3', label: '标题 3', description: '小标题', icon: Heading3, category: 'basic', actionType: 'toggleHeading3' },
  { id: 'bullet', label: '无序列表', description: '创建一个项目符号列表', icon: List, category: 'list', actionType: 'toggleBulletList' },
  { id: 'numbered', label: '有序列表', description: '创建一个编号列表', icon: ListOrdered, category: 'list', actionType: 'toggleOrderedList' },
  { id: 'todo', label: '待办事项', description: '创建任务清单', icon: ListChecks, category: 'list', actionType: 'toggleTaskList' },
  { id: 'quote', label: '引用块', description: '引用文本', icon: Quote, category: 'basic', actionType: 'toggleBlockquote' },
  { id: 'callout', label: '标注框', description: '高亮显示重要内容', icon: ToggleRight, category: 'basic', actionType: 'toggleCallout' },
  { id: 'code', label: '代码块', description: '代码片段', icon: Code, category: 'advanced', actionType: 'toggleCodeBlock' },
  { id: 'divider', label: '分割线', description: '水平分隔线', icon: Minus, category: 'basic', actionType: 'setHorizontalRule' },
  { id: 'wikilink', label: '页面引用', description: '链接到其他笔记', icon: BookOpen, category: 'advanced', actionType: 'wikilink' },
  { id: 'blockref', label: '块引用', description: '引用当前笔记的块', icon: MessageSquare, category: 'advanced', actionType: 'blockref' },
  { id: 'indent', label: '增加缩进', description: '向右增加缩进层级', icon: ChevronRight, category: 'block', actionType: 'sinkList' },
  { id: 'outdent', label: '减少缩进', description: '向左减少缩进层级', icon: ChevronRight, category: 'block', actionType: 'liftList', transform: 'rotate-180' },
  { id: 'image', label: '图片', description: '插入图片', icon: ImageIcon, category: 'media', actionType: 'image' },
  { id: 'table', label: '表格 (3x3)', description: '插入表格', icon: LayoutGrid, category: 'advanced', actionType: 'table' },
  { id: 'mermaid', label: 'Mermaid 图表', description: '插入流程图/时序图', icon: GitBranch, category: 'advanced', actionType: 'insertMermaid' },
];

// Writing templates (loaded dynamically via TemplateManager)
// Toolbar button — extracted outside component to avoid re-creation on every render
function ToolbarButton({ onClick, active, children, title }: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded hover:bg-muted transition-colors ${
        active ? 'bg-muted text-foreground' : 'text-muted-foreground'
      }`}
    >
      {children}
    </button>
  );
}

interface EditorPageProps {
  embedded?: boolean;
  initialTitle?: string;
  initialContent?: string;
  sourceDocument?: SearchHit | null;
  onDraftChange?: (title: string, content: string) => void;
  onSaved?: () => void;
}

export function EditorPage({
  embedded: _embedded = false,
  initialTitle = 'Untitled Document',
  initialContent = '',
  sourceDocument = null,
  onDraftChange,
  onSaved,
}: EditorPageProps) {
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiContext, setAiContext] = useState<ContextFragment[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [showCommands, setShowCommands] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showBlockRefSearch, setShowBlockRefSearch] = useState(false);
  const [outlinePanelOpen, setOutlinePanelOpen] = useState(false);
  const [wikilinkState, setWikilinkState] = useState<WikiLinkState | null>(null);
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const commandRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<HTMLDivElement>(null);
  const lastSeedRef = useRef<string>('');
  const linkInputRef = useRef<HTMLInputElement>(null);
  const slashInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef(title);
  titleRef.current = title;
  const savedNoteIdRef = useRef<string | null>(null);

  // Lowlight instance for code block syntax highlighting
  const lowlightInstance = useMemo(() => createLowlight(common), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // Disable default code block — replaced with CodeBlockLowlight
      }),
      CodeBlockLowlight.configure({
        lowlight: lowlightInstance,
        HTMLAttributes: { class: 'rounded-lg bg-muted/50 border border-border' },
      }),
      Placeholder.configure({
        placeholder: '开始写作，或输入 / 触发斜杠命令...',
      }),
      Typography,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline cursor-pointer' },
      }),
      Image.configure({
        inline: true,
        HTMLAttributes: { class: 'max-w-full rounded-lg' },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      BlockIdExtension,
      BlockReferenceExtension,
      BlockFoldExtension,
      CalloutBlock,
      MermaidBlock,
    ],
    content,
    onUpdate: ({ editor }) => {
      const nextContent = editor.getHTML();
      setContent(nextContent);
      // Count characters for CJK text, words for Latin text
      const text = editor.getText();
      const cjkCount = (text.match(/[一-鿿぀-ゟ゠-ヿ]/g) || []).length;
      const latinWords = text.replace(/[一-鿿぀-ゟ゠-ヿ]/g, ' ').split(/\s+/).filter(Boolean).length;
      setWordCount(cjkCount + latinWords);
      onDraftChange?.(titleRef.current, nextContent);
    },
  });

  // Register wikilink autocomplete plugin
  useEffect(() => {
    if (!editor) return;
    const plugin = wikilinkPlugin(
      (s) => setWikilinkState(s),
      () => setWikilinkState(null),
    );
    editor.registerPlugin(plugin);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const seedKey = `${sourceDocument?.id || 'draft'}:${initialTitle}`;
    if (lastSeedRef.current === seedKey) return;
    lastSeedRef.current = seedKey;
    setTitle(initialTitle);
    editor.commands.setContent(initialContent || '');
    setContent(initialContent || '');
  }, [editor, initialContent, initialTitle, sourceDocument?.id]);

  // Build slash commands with access to editor instance
  const SLASH_COMMANDS = useMemo(() => SLASH_COMMAND_DEFS.map(def => ({
    ...def,
    action: (() => {
      switch (def.actionType) {
        case 'toggleHeading1': return () => editor?.chain().focus().toggleHeading({ level: 1 }).run();
        case 'toggleHeading2': return () => editor?.chain().focus().toggleHeading({ level: 2 }).run();
        case 'toggleHeading3': return () => editor?.chain().focus().toggleHeading({ level: 3 }).run();
        case 'toggleBulletList': return () => editor?.chain().focus().toggleBulletList().run();
        case 'toggleOrderedList': return () => editor?.chain().focus().toggleOrderedList().run();
        case 'toggleTaskList': return () => editor?.chain().focus().toggleTaskList().run();
        case 'toggleBlockquote': return () => editor?.chain().focus().toggleBlockquote().run();
        case 'toggleCallout': return () => editor?.chain().focus().toggleCallout('info').run();
        case 'toggleCodeBlock': return () => editor?.chain().focus().toggleCodeBlock().run();
        case 'setHorizontalRule': return () => editor?.chain().focus().setHorizontalRule().run();
        case 'wikilink': return () => { /* wikilink handled separately */ };
        case 'blockref': return () => { setShowBlockRefSearch(true); };
        case 'sinkList': return () => { editor?.chain().focus().sinkListItem('listItem').run(); };
        case 'liftList': return () => { editor?.chain().focus().liftListItem('listItem').run(); };
        case 'image': return () => {
          const url = window.prompt('输入图片 URL:');
          if (url) editor?.chain().focus().setImage({ src: url }).run();
        };
        case 'table': return () => {
          editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        };
        case 'insertMermaid': return () => {
          editor?.chain().focus().insertMermaid().run();
        };
        default: return () => {};
      }
    })(),
  })), [editor]);

  useEffect(() => {
    onDraftChange?.(title, content);
  }, [title, content, onDraftChange]);

  // Get KB context for AI assistance
  const fetchContext = useCallback(async (query: string) => {
    setAiLoading(true);
    try {
      const result = await api.aiAskContext(query, 5);
      setAiContext(result.context);
      return result.context;
    } catch {
      return [];
    } finally {
      setAiLoading(false);
    }
  }, []);

  // Handle AI command
  const handleAICommand = useCallback(async (command: typeof AI_COMMANDS[0]) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = from !== null && to !== null
      ? editor.state.doc.textBetween(from, to)
      : '';
    const textToProcess = selectedText || editor.getText();

    setShowCommands(false);
    setAiLoading(true);
    setAiPanelOpen(true);

    try {
      // Get KB context first
      const context = await fetchContext(textToProcess.slice(0, 100));
      const prompt = `${command.prompt}\n\n${textToProcess.slice(0, 1600)}\n\nUse the referenced knowledge-base context when it helps.`;
      const result = await api.aiAsk(prompt, Math.max(6, context.length || 4));
      setAiSuggestion(result.answer || 'No suggestion generated.');
    } finally {
      setAiLoading(false);
    }
  }, [editor, fetchContext]);

  const handleSaveDraft = useCallback(async () => {
    if (!title.trim() || !content.trim()) {
      toast(userInputError('Add a draft title and some content before saving to the knowledge base.'));
      return;
    }
    setSaving(true);
    try {
      const saveTags = ['workspace-draft', ...tags];
      if (sourceDocument?.title) {
        saveTags.push('workspace-source');
      }
      const body = sourceDocument
        ? `# Source\n${sourceDocument.title}\n${sourceDocument.source || 'knowledge-base document'}\n\n---\n\n${content}`
        : content;
      if (savedNoteIdRef.current) {
        // Update existing note instead of creating a duplicate
        await api.updateNote(savedNoteIdRef.current, title, body, saveTags);
      } else {
        const newId = await api.addNote(title, body, saveTags);
        savedNoteIdRef.current = newId;
      }
      await api.commit();
      onSaved?.();
    } catch (error) {
      toast(
        classifyAppError(error, {
          fallback: 'Saving the draft failed. Confirm a local knowledge base is open and try again.',
        }),
      );
    } finally {
      setSaving(false);
    }
  }, [title, content, sourceDocument, onSaved, toast]);

  // Insert AI suggestion — parse as HTML to preserve formatting (bold, lists, etc.)
  const insertSuggestion = () => {
    if (!editor || !aiSuggestion) return;
    // Wrap in paragraph tags so TipTap parses it as HTML content
    const htmlContent = aiSuggestion.includes('<') ? aiSuggestion : `<p>${aiSuggestion}</p>`;
    editor.chain().focus().insertContent(htmlContent).run();
    setAiSuggestion(null);
  };

  // Filter slash commands based on filter text
  const filteredSlashCommands = SLASH_COMMANDS.filter(cmd =>
    cmd.label.toLowerCase().includes(slashFilter.toLowerCase()) ||
    cmd.description.toLowerCase().includes(slashFilter.toLowerCase())
  );

  // Check for slash command
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle slash command menu keyboard navigation
    if (showCommands) {
      const totalItems = AI_COMMANDS.length + filteredSlashCommands.length;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSlashIndex((prev) => (prev + 1) % totalItems);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSlashIndex((prev) => (prev - 1 + totalItems) % totalItems);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const idx = selectedSlashIndex;
        if (idx < AI_COMMANDS.length) {
          handleAICommand(AI_COMMANDS[idx]);
        } else {
          const cmdIdx = idx - AI_COMMANDS.length;
          if (filteredSlashCommands[cmdIdx]) {
            filteredSlashCommands[cmdIdx].action();
            setShowCommands(false);
            setSlashFilter('');
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowCommands(false);
        setSlashFilter('');
        setSelectedSlashIndex(0);
      }
      return;
    }

    if (e.key === '/' && editor) {
      // Trigger slash commands when current line/paragraph is empty (not just entire editor)
      const { $from } = editor.state.selection;
      const currentLineText = $from.parent.textContent;
      if (!currentLineText || currentLineText.trim() === '') {
        e.preventDefault();
        setShowCommands(true);
      }
    }
    if (e.key === 'Escape') {
      setShowCommands(false);
      setShowTemplates(false);
      setAiPanelOpen(false);
    }
  };

  // Handle template selection
  const handleTemplateSelect = (template: EditorTemplate) => {
    // Replace template variables: {{date}}, {{time}}, {{title}}, {{tags}}
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5);
    const resolvedTitle = template.title
      .replace(/\{\{date\}\}/g, dateStr)
      .replace(/\{\{time\}\}/g, timeStr);
    const resolvedContent = template.content
      .replace(/\{\{date\}\}/g, dateStr)
      .replace(/\{\{time\}\}/g, timeStr)
      .replace(/\{\{title\}\}/g, resolvedTitle)
      .replace(/\{\{tags\}\}/g, tags.join(', '));

    setTitle(resolvedTitle);
    if (editor) {
      editor.commands.setContent(resolvedContent);
    }
    setShowTemplates(false);
  };

  // Insert link
  const handleInsertLink = () => {
    if (!linkUrl.trim() || !editor) {
      setShowLinkInput(false);
      setLinkUrl('');
      return;
    }
    const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
    const { from, to } = editor.state.selection;
    const hasText = from !== to;
    if (hasText) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    } else {
      editor.chain().focus().insertContent(`<a href="${url}">${linkUrl}</a>`).run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  };

  // Insert code block
  const handleInsertCodeBlock = () => {
    editor?.chain().focus().toggleCodeBlock().run();
  };

  // Insert block reference
  const handleInsertBlockReference = (blockId: string, blockTitle: string) => {
    editor?.chain().focus().insertContent({
      type: 'blockReference',
      attrs: { blockId, blockTitle },
    }).run();
    setShowBlockRefSearch(false);
  };

  // Handle Cmd+K for link insertion
  useEffect(() => {
    if (!editor) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowLinkInput(true);
        setTimeout(() => linkInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editor]);

  return (
    <div className="flex h-full" onKeyDown={handleKeyDown}>
      {/* Outline Panel sidebar */}
      <OutlinePanel
        editor={editor}
        open={outlinePanelOpen}
        onClose={() => setOutlinePanelOpen(false)}
      />

      {/* Main editor area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-3 border-b bg-card/40 flex items-center justify-between">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="text-lg font-semibold bg-transparent border-none outline-none flex-1"
            placeholder="文档标题..."
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{wordCount} 字</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSaveDraft()}
              className="text-xs gap-1.5"
              disabled={saving || !title.trim() || !content.trim()}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              保存草稿
            </Button>
            <div className="relative" ref={templateRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTemplates(!showTemplates)}
                className="text-xs gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" />
                模板
              </Button>
              {showTemplates && (
                <div className="absolute right-0 top-full mt-1 bg-card border rounded-lg shadow-lg p-2 w-56 z-50">
                  <div className="flex items-center justify-between px-2 mb-1">
                    <div className="text-[10px] text-muted-foreground">写作模板</div>
                    <button
                      onClick={() => { setShowTemplates(false); setShowTemplateManager(true); }}
                      className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                    >
                      管理
                    </button>
                  </div>
                  {getTemplates().map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleTemplateSelect(t)}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-[13px] transition-colors"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAiPanelOpen(!aiPanelOpen)}
              className="text-xs gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI 辅助
            </Button>
          </div>
        </div>

        {/* Frontmatter: Tags */}
        <div className="px-6 py-2 border-b bg-card/20 flex items-center gap-2 flex-wrap">
          {tags.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary"
            >
              {tag}
              <button
                type="button"
                onClick={() => setTags(t => t.filter((_, j) => j !== i))}
                className="hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                e.preventDefault();
                const newTag = tagInput.trim().replace(/,$/, '');
                if (newTag && !tags.includes(newTag)) {
                  setTags(t => [...t, newTag]);
                }
                setTagInput('');
              }
              if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
                setTags(t => t.slice(0, -1));
              }
            }}
            placeholder="添加标签 (回车确认)..."
            className="text-xs bg-transparent border-none outline-none flex-1 min-w-[120px] text-muted-foreground"
          />
        </div>

        {/* Toolbar */}
        <div className="px-6 py-2 border-b bg-card/20 flex items-center gap-1">
          <ToolbarButton
            title="Toggle Outline"
            onClick={() => setOutlinePanelOpen(!outlinePanelOpen)}
            active={outlinePanelOpen}
          >
            <PanelRight className="h-4 w-4" />
          </ToolbarButton>
          <div className="w-px h-5 bg-border mx-1" />
          <ToolbarButton
            title="Bold"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            active={editor?.isActive('bold')}
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Italic"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            active={editor?.isActive('italic')}
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Strikethrough"
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            active={editor?.isActive('strike')}
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Code"
            onClick={() => editor?.chain().focus().toggleCode().run()}
            active={editor?.isActive('code')}
          >
            <Code className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Quote"
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            active={editor?.isActive('blockquote')}
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <div className="w-px h-5 bg-border mx-2" />
          <ToolbarButton
            title="Heading 1"
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor?.isActive('heading', { level: 1 })}
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Heading 2"
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor?.isActive('heading', { level: 2 })}
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Heading 3"
            onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor?.isActive('heading', { level: 3 })}
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>
          <div className="w-px h-5 bg-border mx-2" />
          <ToolbarButton
            title="Link (Cmd+K)"
            onClick={() => {
              setShowLinkInput(!showLinkInput);
              if (!showLinkInput) setTimeout(() => linkInputRef.current?.focus(), 50);
            }}
            active={editor?.isActive('link')}
          >
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Code block"
            onClick={() => handleInsertCodeBlock()}
            active={editor?.isActive('codeBlock')}
          >
            <Type className="h-4 w-4" />
          </ToolbarButton>
          <div className="w-px h-5 bg-border mx-2" />
          <ToolbarButton
            title="Bullet list"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            active={editor?.isActive('bulletList')}
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Numbered list"
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            active={editor?.isActive('orderedList')}
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Task list"
            onClick={() => editor?.chain().focus().toggleTaskList().run()}
            active={editor?.isActive('taskList')}
          >
            <CheckSquare className="h-4 w-4" />
          </ToolbarButton>
          <div className="w-px h-5 bg-border mx-2" />
          <ToolbarButton
            title="Insert table"
            onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            active={editor?.isActive('table')}
          >
            <LayoutGrid className="h-4 w-4" />
          </ToolbarButton>
          <div className="w-px h-5 bg-border mx-2" />
          <ToolbarButton
            title="Undo"
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Redo"
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Editor content */}
        <div className="flex-1 overflow-auto relative">
          {/* Link input popup */}
          {showLinkInput && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-card border rounded-lg shadow-lg p-3 w-80 flex gap-2">
              <input
                ref={linkInputRef}
                type="text"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); handleInsertLink(); }
                  if (e.key === 'Escape') { setShowLinkInput(false); setLinkUrl(''); }
                }}
                placeholder="https://example.com"
                className="flex-1 px-3 py-1.5 rounded border dark:bg-background bg-white text-sm outline-none focus:ring-1 focus:ring-ring"
              />
              <Button size="sm" onClick={handleInsertLink} className="text-xs">插入</Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowLinkInput(false); setLinkUrl(''); }} className="text-xs">取消</Button>
            </div>
          )}

          {/* Bubble menu for text formatting */}
          <BlockBubbleMenu editor={editor} />

          {/* Floating menu for block conversion */}
          <BlockFloatingMenu editor={editor} />

          {/* Slash commands popup - Notion style */}
          {showCommands && (
            <div
              ref={commandRef}
              className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-xl shadow-lg w-80 overflow-hidden"
            >
              {/* Search input */}
              <div className="p-3 border-b border-border">
                <input
                  ref={slashInputRef}
                  type="text"
                  value={slashFilter}
                  onChange={(e) => {
                    setSlashFilter(e.target.value);
                    setSelectedSlashIndex(0);
                  }}
                  placeholder="Filter commands..."
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
                  autoFocus
                />
              </div>
              {/* Command categories */}
              <div className="max-h-80 overflow-y-auto p-2">
                {/* AI Commands */}
                <div className="mb-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 py-1">AI 辅助</div>
                  {AI_COMMANDS.map((cmd) => (
                    <button
                      key={cmd.id}
                      onClick={() => handleAICommand(cmd)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted text-left transition"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <cmd.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm text-foreground">{cmd.label}</div>
                        <div className="text-[10px] text-muted-foreground">{cmd.prompt.slice(0, 30)}...</div>
                      </div>
                    </button>
                  ))}
                </div>
                {/* Block commands */}
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 py-1">插入块</div>
                  {SLASH_COMMANDS.filter(cmd =>
                    cmd.label.toLowerCase().includes(slashFilter.toLowerCase()) ||
                    cmd.description.toLowerCase().includes(slashFilter.toLowerCase())
                  ).map((cmd) => (
                    <button
                      key={cmd.id}
                      onClick={() => {
                        cmd.action();
                        setShowCommands(false);
                        setSlashFilter('');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted text-left transition"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <cmd.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm text-foreground">{cmd.label}</div>
                        <div className="text-[10px] text-muted-foreground">{cmd.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              {/* Keyboard hint */}
              <div className="p-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
                <span>↑↓ 导航</span>
                <span>Enter 选择</span>
                <span>Esc 关闭</span>
              </div>
            </div>
          )}

          <EditorContent
            editor={editor}
            className="prose prose-sm dark:prose-invert max-w-none px-6 py-4 outline-none min-h-full"
          />

          {/* Backlinks panel — shows after editor content */}
          {savedNoteIdRef.current && (
            <div className="px-6 pb-6 space-y-4">
              <EditorBacklinksPanel noteId={savedNoteIdRef.current} />
              {/* Per-note local graph */}
              <LocalGraph
                noteId={savedNoteIdRef.current}
                noteTitle={title}
              />
            </div>
          )}
        </div>
      </div>

      {/* AI Assistant sidebar */}
      {aiPanelOpen && (
        <div className="w-80 border-l bg-card/40 flex flex-col shrink-0">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="text-xs font-medium">AI 助手</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAiPanelOpen(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <ScrollArea className="flex-1 p-3">
            {/* KB Context */}
            {aiContext.length > 0 && (
              <div className="mb-4">
                <div className="text-[10px] font-medium text-muted-foreground mb-2">
                  Context from KB ({aiContext.length} 个片段)
                </div>
                <div className="space-y-2">
                  {aiContext.slice(0, 3).map((frag, i) => (
                    <div key={i} className="p-2 bg-muted/50 rounded text-[11px]">
                      <div className="font-medium truncate">{frag.title || '未命名'}</div>
                      <div className="text-muted-foreground text-[10px] mt-1 line-clamp-2">
                        {frag.text.slice(0, 100)}...
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Suggestion */}
            {aiLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                <Loader2 className="h-3 w-3 animate-spin" />
                正在获取 AI 协助...
              </div>
            ) : aiSuggestion ? (
              <div>
                <div className="text-[10px] font-medium text-muted-foreground mb-2">AI 建议</div>
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-[13px]">
                  {aiSuggestion}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={insertSuggestion} className="text-xs flex-1">
                    插入
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAiSuggestion(null)} className="text-xs">
                    忽略
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-8">
                <Sparkles className="h-6 w-6 mx-auto mb-2 opacity-40" />
                选中文字并使用 AI 命令，或在编辑器中输入 / 触发
              </div>
            )}
          </ScrollArea>

          {/* Quick actions */}
          <div className="p-3 border-t">
            <div className="text-[10px] font-medium text-muted-foreground mb-2">快捷操作</div>
            <div className="grid grid-cols-2 gap-1">
              {AI_COMMANDS.slice(0, 4).map(cmd => (
                <Button
                  key={cmd.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleAICommand(cmd)}
                  className="text-[10px] justify-start"
                >
                  <cmd.icon className="h-3 w-3 mr-1" />
                  {cmd.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showTemplateManager && (
        <TemplateManager
          onClose={() => setShowTemplateManager(false)}
          onSelect={(template) => {
            handleTemplateSelect(template);
            setShowTemplates(false);
          }}
        />
      )}

      {wikilinkState && (
        <WikiLinkAutocomplete
          editor={editor}
          state={wikilinkState}
          onSelect={(_noteTitle: string) => {
            // Sync note links after inserting a wikilink so backlinks are tracked
            if (savedNoteIdRef.current) {
              api.syncNoteLinks(savedNoteIdRef.current).catch(() => {});
            }
          }}
          onClose={() => setWikilinkState(null)}
          onQueryChange={(query) => setWikilinkState((s) => s ? { ...s, query } : null)}
        />
      )}

      {/* Block Reference Search Modal */}
      {showBlockRefSearch && (
        <BlockReferenceSearch
          editor={editor}
          onSelect={handleInsertBlockReference}
          onClose={() => setShowBlockRefSearch(false)}
        />
      )}
    </div>
  );
}

/**
 * Backlinks panel for the editor page.
 * Wraps the shared BacklinksPanel — in the editor context, navigation is
 * handled by the global KB store (user can Cmd+Click to open the note).
 */
function EditorBacklinksPanel({ noteId }: { noteId: string }) {
  const [backlinks, setBacklinks] = useState<Array<{ note_id: string; note_title: string; context_snippet: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.listBacklinks(noteId)
      .then((result) => { if (!cancelled) setBacklinks(result); })
      .catch(() => { if (!cancelled) setBacklinks([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [noteId]);

  if (loading) return null;
  if (backlinks.length === 0) return null;

  return (
    <div className="mt-4 border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition"
      >
        <BookOpen className="h-3.5 w-3.5" />
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
              onClick={async () => {
                try {
                  const note = await api.getNote(bl.note_id);
                  // Open the referenced note in a new editing session
                  const { useKbStore } = await import('@/store/kb-store');
                  useKbStore.getState().openDocument({
                    id: note.id,
                    title: note.title,
                    content: note.content,
                    score: 0,
                    tags: note.tags,
                    created_at: note.created_at,
                    source: null,
                  });
                } catch { /* ignore */ }
              }}
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

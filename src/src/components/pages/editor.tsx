import { useState, useCallback, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import {
  Bold, Italic, List, ListOrdered, Strikethrough, Code, Quote,
  Undo, Redo, Sparkles, Wand2, ChevronDown, Loader2, X, FileText, Save,
  Heading1, Heading2, Heading3, LinkIcon, Type
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/api/commands';
import type { ContextFragment, SearchHit } from '@/api';
import { useToast } from '@/hooks/use-toast';
import { classifyAppError, userInputError } from '@/lib/app-error';

// AI command suggestions
const AI_COMMANDS = [
  { id: 'continue', label: 'Continue writing', icon: Wand2, prompt: 'Continue the following text in the same style and tone:' },
  { id: 'improve', label: 'Improve clarity', icon: Sparkles, prompt: 'Improve the clarity and readability of:' },
  { id: 'shorten', label: 'Make shorter', icon: ChevronDown, prompt: 'Make this more concise while keeping the key points:' },
  { id: 'expand', label: 'Expand details', icon: List, prompt: 'Expand on this with more details and examples:' },
  { id: 'fix', label: 'Fix grammar', icon: Code, prompt: 'Fix any grammar or spelling errors in:' },
];

// Writing templates
const TEMPLATES = [
  {
    id: 'blank',
    label: 'Blank',
    title: 'Untitled Document',
    content: '',
  },
  {
    id: 'article',
    label: 'Article',
    title: 'Article Title',
    content: '<h2>Introduction</h2><p>Start with an engaging introduction...</p><h2>Main Points</h2><p>Discuss the key ideas...</p><h2>Conclusion</h2><p>Summarize and provide takeaways...</p>',
  },
  {
    id: 'report',
    label: 'Report',
    title: 'Report Title',
    content: '<h2>Executive Summary</h2><p>Brief overview of findings...</p><h2>Background</h2><p>Context and motivation...</p><h2>Analysis</h2><p>Detailed findings...</p><h2>Recommendations</h2><ul><li>Recommendation 1</li><li>Recommendation 2</li></ul><h2>Conclusion</h2><p>Final thoughts...</p>',
  },
  {
    id: 'email',
    label: 'Email',
    title: 'Email Draft',
    content: '<p>Hi [Recipient],</p><p>I hope this message finds you well.</p><p>[Main content here]</p><p>Best regards,<br/>[Your name]</p>',
  },
  {
    id: 'notes',
    label: 'Meeting Notes',
    title: 'Meeting Notes',
    content: '<h2>Meeting: [Topic]</h2><p><strong>Date:</strong> [Date] | <strong>Attendees:</strong> [Names]</p><h3>Agenda</h3><ol><li>Topic 1</li><li>Topic 2</li></ol><h3>Action Items</h3><ul><li>[ ] Task 1 — @person</li><li>[ ] Task 2 — @person</li></ul><h3>Notes</h3><p>Key discussion points...</p>',
  },
  {
    id: 'proposal',
    label: 'Proposal',
    title: 'Proposal Title',
    content: '<h2>Problem Statement</h2><p>What problem are we solving?</p><h2>Proposed Solution</h2><p>How will we solve it?</p><h2>Implementation Plan</h2><ol><li>Phase 1: ...</li><li>Phase 2: ...</li></ol><h2>Timeline & Budget</h2><p>Estimated timeline and costs...</p><h2>Expected Outcomes</h2><ul><li>Outcome 1</li><li>Outcome 2</li></ul>',
  },
];

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
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const commandRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<HTMLDivElement>(null);
  const lastSeedRef = useRef<string>('');
  const linkInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing, or type / for AI commands...',
      }),
      Typography,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline cursor-pointer' },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const nextContent = editor.getHTML();
      setContent(nextContent);
      setWordCount(editor.getText().split(/\s+/).filter(Boolean).length);
      onDraftChange?.(title, nextContent);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const seedKey = `${sourceDocument?.id || 'draft'}:${initialTitle}`;
    if (lastSeedRef.current === seedKey) return;
    lastSeedRef.current = seedKey;
    setTitle(initialTitle);
    editor.commands.setContent(initialContent || '');
    setContent(initialContent || '');
  }, [editor, initialContent, initialTitle, sourceDocument?.id]);

  useEffect(() => {
    onDraftChange?.(title, content);
  }, [title]);

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
      const tags = ['workspace-draft'];
      if (sourceDocument?.title) {
        tags.push('workspace-source');
      }
      const body = sourceDocument
        ? `# Source\n${sourceDocument.title}\n${sourceDocument.source || 'knowledge-base document'}\n\n---\n\n${content}`
        : content;
      await api.addNote(title, body, tags);
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

  // Insert AI suggestion
  const insertSuggestion = () => {
    if (!editor || !aiSuggestion) return;
    editor.chain().focus().insertContent(aiSuggestion).run();
    setAiSuggestion(null);
  };

  // Toolbar button component
  const ToolbarButton = ({ onClick, active, children, title }: {
    onClick: () => void;
    active?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
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

  // Check for slash command
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === '/' && editor?.isEmpty) {
      setShowCommands(true);
    }
    if (e.key === 'Escape') {
      setShowCommands(false);
      setShowTemplates(false);
      setAiPanelOpen(false);
    }
  };

  // Handle template selection
  const handleTemplateSelect = (template: typeof TEMPLATES[0]) => {
    setTitle(template.title);
    if (editor) {
      editor.commands.setContent(template.content);
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
      {/* Main editor area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-3 border-b bg-card/40 flex items-center justify-between">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="text-lg font-semibold bg-transparent border-none outline-none flex-1"
            placeholder="Document title..."
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
                Templates
              </Button>
              {showTemplates && (
                <div className="absolute right-0 top-full mt-1 bg-card border rounded-lg shadow-lg p-2 w-56 z-50">
                  <div className="text-[10px] text-muted-foreground px-2 mb-1">Writing Templates</div>
                  {TEMPLATES.map(t => (
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
              AI Assist
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-2 border-b bg-card/20 flex items-center gap-1">
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

          {/* Slash commands popup */}
          {showCommands && (
            <div
              ref={commandRef}
              className="absolute top-4 left-6 z-50 bg-card border rounded-lg shadow-lg p-2 w-64"
            >
              <div className="text-[10px] text-muted-foreground px-2 mb-1">AI Commands</div>
              {AI_COMMANDS.map(cmd => (
                <button
                  key={cmd.id}
                  onClick={() => handleAICommand(cmd)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-left text-[13px]"
                >
                  <cmd.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{cmd.label}</span>
                </button>
              ))}
            </div>
          )}

          <EditorContent
            editor={editor}
            className="prose prose-sm dark:prose-invert max-w-none px-6 py-4 outline-none min-h-full"
          />
        </div>
      </div>

      {/* AI Assistant sidebar */}
      {aiPanelOpen && (
        <div className="w-80 border-l bg-card/40 flex flex-col shrink-0">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="text-xs font-medium">AI Assistant</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAiPanelOpen(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <ScrollArea className="flex-1 p-3">
            {/* KB Context */}
            {aiContext.length > 0 && (
              <div className="mb-4">
                <div className="text-[10px] font-medium text-muted-foreground mb-2">
                  Context from KB ({aiContext.length} fragments)
                </div>
                <div className="space-y-2">
                  {aiContext.slice(0, 3).map((frag, i) => (
                    <div key={i} className="p-2 bg-muted/50 rounded text-[11px]">
                      <div className="font-medium truncate">{frag.title || 'Untitled'}</div>
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
                Getting AI assistance...
              </div>
            ) : aiSuggestion ? (
              <div>
                <div className="text-[10px] font-medium text-muted-foreground mb-2">AI Suggestion</div>
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-[13px]">
                  {aiSuggestion}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={insertSuggestion} className="text-xs flex-1">
                    Insert
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAiSuggestion(null)} className="text-xs">
                    Dismiss
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-8">
                <Sparkles className="h-6 w-6 mx-auto mb-2 opacity-40" />
                Select text and use an AI command, or type / in the editor
              </div>
            )}
          </ScrollArea>

          {/* Quick actions */}
          <div className="p-3 border-t">
            <div className="text-[10px] font-medium text-muted-foreground mb-2">Quick Actions</div>
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
    </div>
  );
}

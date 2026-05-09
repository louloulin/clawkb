import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Loader2, FileText, Tags, CheckCircle2, CloudOff, Cloud, Pencil, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/api';
import { useToast } from '@/hooks/use-toast';
import { RichEditor } from '@/components/ui/rich-editor';

interface NotesPageProps {
  embedded?: boolean;
  initialTitle?: string;
  initialContent?: string;
  initialTags?: string[];
  initialNoteId?: string;
  onSaved?: () => void;
  onBack?: () => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const AUTO_SAVE_DELAY_MS = 3000;

export function NotesPage({
  embedded = false,
  initialTitle = '',
  initialContent = '',
  initialTags = [],
  initialNoteId,
  onSaved,
  onBack,
}: NotesPageProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [plainText, setPlainText] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(initialNoteId ?? null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>('');

  // Load existing note when initialNoteId is provided
  useEffect(() => {
    if (!initialNoteId) return;
    setLoading(true);
    setEditingNoteId(initialNoteId);
    api.getNote(initialNoteId)
      .then((note) => {
        setTitle(note.title);
        setContent(note.content);
        setTags(note.tags.join(', '));
        lastSaved.current = `${note.title}::${note.content}`;
      })
      .catch(() => {
        toast({ title: '加载失败', description: '无法加载笔记，请确认笔记存在。', variant: 'destructive' });
      })
      .finally(() => setLoading(false));
  }, [initialNoteId]);

  // Stable serialized tags for dependency comparison
  const serializedTags = useMemo(() => initialTags.join(','), [initialTags]);

  // Sync initial values (only for new notes)
  useEffect(() => {
    if (editingNoteId) return; // Skip for existing notes
    setTitle(initialTitle);
    setContent(initialContent);
    setTags(initialTags.join(', '));
    lastSaved.current = `${initialTitle}::${initialContent}`;
  }, [initialTitle, initialContent, serializedTags, editingNoteId]);

  // Debounced auto-save
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setSaveStatus('idle');
    if (!title.trim() && !plainText.trim()) return;

    autoSaveTimer.current = setTimeout(async () => {
      const snapshot = `${title}::${content}`;
      if (snapshot === lastSaved.current) return;

      setSaving(true);
      setSaveStatus('saving');
      try {
        const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
        if (editingNoteId) {
          await api.updateNote(editingNoteId, title, content, tagList);
        } else {
          const newId = await api.addNote(title, content, tagList);
          await api.commit();
          setEditingNoteId(newId); // Capture the new note ID to prevent duplicates
        }
        lastSaved.current = snapshot;
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      } finally {
        setSaving(false);
      }
    }, AUTO_SAVE_DELAY_MS);
  }, [title, content, tags, plainText, editingNoteId]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    scheduleAutoSave();
  };

  const handleContentChange = (html: string, text: string) => {
    setContent(html);
    setPlainText(text);
    scheduleAutoSave();
  };

  const handleTagsChange = (value: string) => {
    setTags(value);
    scheduleAutoSave();
  };

  const handleManualSave = async () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    if (!title.trim() || !plainText.trim()) return;
    setSaving(true);
    setSaveStatus('saving');
    try {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      if (editingNoteId) {
        await api.updateNote(editingNoteId, title, content, tagList);
      } else {
        await api.addNote(title, content, tagList);
        await api.commit();
      }
      lastSaved.current = `${title}::${content}`;
      setSaveStatus('saved');
      onSaved?.();
      toast({ title: '已保存', description: `"${title}" 已保存到知识库。` });
    } catch {
      setSaveStatus('error');
      toast({ title: '保存失败', description: '请确认已打开本地知识库。', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); }, []);

  const SaveIndicator = () => {
    if (saveStatus === 'idle') return null;
    if (saveStatus === 'saving') return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Cloud className="h-3 w-3 animate-pulse" /> 自动保存中...
      </span>
    );
    if (saveStatus === 'saved') return (
      <span className="flex items-center gap-1 text-xs text-emerald-500">
        <CheckCircle2 className="h-3 w-3" /> 已保存
      </span>
    );
    if (saveStatus === 'error') return (
      <span className="flex items-center gap-1 text-xs text-red-400">
        <CloudOff className="h-3 w-3" /> 保存失败
      </span>
    );
    return null;
  };

  const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      {!embedded && (
        <div className="mb-6">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 rounded-lg">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <h2 className="text-xl font-semibold mb-1">
                {editingNoteId ? (
                  <span className="flex items-center gap-2">
                    <Pencil className="h-4 w-4" /> 编辑笔记
                  </span>
                ) : '添加笔记'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {editingNoteId ? '修改笔记内容，3 秒自动保存' : '捕捉新想法或知识片段，3 秒自动保存'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5">
        <div>
          <Label htmlFor="note-title" className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <FileText className="h-3 w-3" /> 标题
          </Label>
          <Input
            id="note-title"
            type="text"
            value={title}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder="笔记标题"
            className="rounded-xl border-border/50 h-10"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label htmlFor="note-content" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              内容
            </Label>
            <SaveIndicator />
          </div>
          <RichEditor
            content={content}
            onChange={handleContentChange}
            placeholder="在此输入笔记内容... 支持 Markdown 格式"
            className="rounded-xl border border-border/50 min-h-[300px]"
            editorClassName="min-h-[300px]"
          />
        </div>

        <div>
          <Label htmlFor="note-tags" className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <Tags className="h-3 w-3" /> 标签
          </Label>
          <Input
            id="note-tags"
            type="text"
            value={tags}
            onChange={e => handleTagsChange(e.target.value)}
            placeholder="用逗号分隔多个标签"
            className="rounded-xl border-border/50 h-10"
          />
          {tagList.length > 0 && (
            <div className="flex gap-1.5 mt-2.5 flex-wrap">
              {tagList.map(tag => (
                <span key={tag} className="inline-flex items-center text-[11px] text-primary bg-primary/8 px-2 py-0.5 rounded-md font-medium">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2">
          <Button
            onClick={handleManualSave}
            disabled={saving || !title.trim() || !plainText.trim()}
            className="gap-2 rounded-xl h-10 px-6"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> 保存中...</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" /> {editingNoteId ? '保存修改' : '保存笔记'}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

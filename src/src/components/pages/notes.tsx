import { useEffect, useState } from 'react';
import { Loader2, FileText, Tags, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { api } from '@/api';
import { useToast } from '@/hooks/use-toast';

interface NotesPageProps {
  embedded?: boolean;
  initialTitle?: string;
  initialContent?: string;
  initialTags?: string[];
  onSaved?: () => void;
}

export function NotesPage({
  embedded = false,
  initialTitle = '',
  initialContent = '',
  initialTags = [],
  onSaved,
}: NotesPageProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setTitle(initialTitle);
    setContent(initialContent);
    setTags(initialTags.join(', '));
  }, [initialTitle, initialContent, initialTags.join(',')]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      await api.addNote(title, content, tagList);
      await api.commit();
      toast({ title: 'Note saved', description: `"${title}" has been added.` });
      setTitle('');
      setContent('');
      setTags('');
      onSaved?.();
    } catch (e) {
      toast({ title: 'Error', description: String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      {!embedded && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-1">Add Note</h2>
          <p className="text-sm text-muted-foreground">Capture a new thought or piece of knowledge</p>
        </div>
      )}

      <div className="space-y-5">
        <div>
          <Label htmlFor="note-title" className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <FileText className="h-3 w-3" /> Title
          </Label>
          <Input
            id="note-title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Note title"
            className="rounded-xl border-border/50 h-10"
          />
        </div>
        <div>
          <Label htmlFor="note-content" className="mb-2 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Content</Label>
          <Textarea
            id="note-content"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Write your note here... (Markdown supported)"
            rows={16}
            className="rounded-xl border-border/50 font-mono text-sm resize-none leading-relaxed"
          />
        </div>
        <div>
          <Label htmlFor="note-tags" className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <Tags className="h-3 w-3" /> Tags
          </Label>
          <Input
            id="note-tags"
            type="text"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="Comma separated"
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
            onClick={handleSave}
            disabled={saving || !title.trim() || !content.trim()}
            className="gap-2 rounded-xl h-10 px-6"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" /> Save Note</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, X, BookOpen, Globe, PenLine, MessageSquare, AlignLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

type Action = 'explain' | 'translate' | 'rewrite' | 'summarize' | 'ask';

interface SelectionPanelProps {
  visible: boolean;
  selectedText: string;
  onClose: () => void;
}

const ACTIONS: { id: Action; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'explain', label: '解释', icon: <BookOpen className="h-4 w-4" />, desc: 'Explain the selected text' },
  { id: 'translate', label: '翻译', icon: <Globe className="h-4 w-4" />, desc: 'Translate to the opposite language' },
  { id: 'rewrite', label: '改写', icon: <PenLine className="h-4 w-4" />, desc: 'Rewrite more clearly' },
  { id: 'summarize', label: '摘要', icon: <AlignLeft className="h-4 w-4" />, desc: 'Summarize key points' },
  { id: 'ask', label: '问答', icon: <MessageSquare className="h-4 w-4" />, desc: 'Ask questions about it' },
];

export function SelectionPanel({ visible, selectedText, onClose }: SelectionPanelProps) {
  const [text, setText] = useState(selectedText);
  const [customQuestion, setCustomQuestion] = useState('');
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);

  // Update text when selectedText changes
  useEffect(() => {
    if (selectedText) setText(selectedText);
  }, [selectedText]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleAction = useCallback(async (action: Action) => {
    if (!text.trim()) return;
    setActiveAction(action);
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // Dynamic import to avoid loading Tauri API in browser
      const { api } = await import('@/api');
      const res = await api.selectionAi(action, text.trim());
      if (res.success) {
        setResult(res.output);
      } else {
        setError(res.error || 'Action failed');
        toast({ title: 'Action Failed', description: res.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (e) {
      setError(String(e));
      toast({ title: 'Error', description: String(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [text, toast]);

  const handleCustomAsk = useCallback(async () => {
    if (!text.trim() || !customQuestion.trim()) return;
    setActiveAction('ask');
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const { api } = await import('@/api');
      const fullText = `${customQuestion.trim()}\n\n相关文本：\n${text.trim()}`;
      const res = await api.selectionAi('ask', fullText);
      if (res.success) {
        setResult(res.output);
      } else {
        setError(res.error || 'Action failed');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [text, customQuestion, toast]);

  const handleCopy = useCallback(() => {
    if (result) {
      navigator.clipboard.writeText(result);
      toast({ title: 'Copied to clipboard' });
    }
  }, [result, toast]);

  const handleSaveToKb = useCallback(async () => {
    if (!result) return;
    try {
      const { api } = await import('@/api');
      await api.addNote(
        `Selection: ${activeAction || 'ask'}`,
        `Selected text:\n${text}\n\nResult:\n${result}`,
        ['selection', activeAction || 'ask']
      );
      await api.commit();
      toast({ title: 'Saved to knowledge base' });
    } catch (e) {
      toast({ title: 'Save failed', description: String(e), variant: 'destructive' });
    }
  }, [result, text, activeAction, toast]);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-6 right-6 w-[420px] max-h-[70vh] dark:bg-background bg-transparent border border-border/80 rounded-2xl shadow-2xl z-[100] flex flex-col overflow-hidden"
      ref={panelRef}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
        <div>
          <h3 className="text-sm font-semibold">ClawKB Selection AI</h3>
          <p className="text-[10px] text-muted-foreground">Cmd+Shift+K to toggle</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Selected text */}
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Selected Text</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            className="w-full h-20 rounded-lg bg-muted/40 border border-border/30 p-2 text-[12px] text-foreground resize-none"
            placeholder="Paste or type text here..."
          />
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-5 gap-1.5">
          {ACTIONS.map(action => (
            <button
              key={action.id}
              onClick={() => handleAction(action.id)}
              disabled={!text.trim() || loading}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl text-[11px] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                activeAction === action.id && !result
                  ? 'bg-primary/10 border border-primary/30 text-primary'
                  : 'bg-muted/40 border border-transparent hover:bg-muted/60'
              }`}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>

        {/* Custom question */}
        <div className="flex gap-2">
          <Input
            value={customQuestion}
            onChange={e => setCustomQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCustomAsk()}
            placeholder="Ask a custom question..."
            className="flex-1 h-8 rounded-xl border-border/50 text-[12px]"
          />
          <Button
            size="sm"
            onClick={handleCustomAsk}
            disabled={!text.trim() || !customQuestion.trim() || loading}
            className="h-8 rounded-xl text-[12px] px-3"
          >
            Ask
          </Button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-[12px]">Processing with AI...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-[12px] text-destructive">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {activeAction === 'explain' ? 'Explanation' :
                  activeAction === 'translate' ? 'Translation' :
                    activeAction === 'rewrite' ? 'Rewritten' :
                      activeAction === 'summarize' ? 'Summary' : 'Answer'}
              </span>
              <div className="flex-1" />
              <button onClick={handleCopy} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                Copy
              </button>
              <button onClick={handleSaveToKb} className="text-[10px] text-primary hover:text-primary/80 transition-colors">
                Save
              </button>
            </div>
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
              <p className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">
                {result}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

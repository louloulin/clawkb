import { CheckCircle2, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DocumentToolbarProps {
  onSaveDraft: () => Promise<void>;
  savingDraft: boolean;
  lastSavedAt: string | null;
}

export function DocumentToolbar({
  onSaveDraft,
  savingDraft,
  lastSavedAt,
}: DocumentToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary px-5 py-3">
      <div className="text-sm text-foreground/80">当前笔记和草稿都会保存回这个知识库。</div>
      <div className="ml-auto flex items-center gap-2">
        {lastSavedAt && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            已保存 {new Date(lastSavedAt).toLocaleTimeString()}
          </span>
        )}
        <Button
          onClick={() => void onSaveDraft()}
          disabled={savingDraft}
          className="h-10 rounded-full bg-amber-300 px-4 text-foreground hover:bg-amber-200"
        >
          {savingDraft ? <Sparkles className="mr-2 h-4 w-4 animate-pulse" /> : <Save className="mr-2 h-4 w-4" />}
          保存草稿到知识库
        </Button>
      </div>
    </div>
  );
}

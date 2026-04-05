import { CheckCircle2, FilePenLine, Mic, NotebookText, Save, ScrollText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DocumentWorkspaceTab } from '@/store/document-workspace-store';

interface DocumentToolbarProps {
  onTabChange: (tab: DocumentWorkspaceTab) => void;
  onSaveDraft: () => Promise<void>;
  savingDraft: boolean;
  lastSavedAt: string | null;
}

export function DocumentToolbar({
  onTabChange,
  onSaveDraft,
  savingDraft,
  lastSavedAt,
}: DocumentToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-black/20 px-5 py-3">
      <Button
        variant="outline"
        onClick={() => onTabChange('draft')}
        className="h-9 rounded-full border-white/10 bg-white/4 px-4 text-sm text-white hover:bg-white/10"
      >
        <FilePenLine className="mr-2 h-4 w-4" />
        Continue Draft
      </Button>
      <Button
        variant="outline"
        onClick={() => onTabChange('notes')}
        className="h-9 rounded-full border-white/10 bg-white/4 px-4 text-sm text-white hover:bg-white/10"
      >
        <NotebookText className="mr-2 h-4 w-4" />
        Capture Note
      </Button>
      <Button
        variant="outline"
        onClick={() => onTabChange('report')}
        className="h-9 rounded-full border-white/10 bg-white/4 px-4 text-sm text-white hover:bg-white/10"
      >
        <ScrollText className="mr-2 h-4 w-4" />
        Generate Report
      </Button>
      <Button
        variant="outline"
        onClick={() => onTabChange('podcast')}
        className="h-9 rounded-full border-white/10 bg-white/4 px-4 text-sm text-white hover:bg-white/10"
      >
        <Mic className="mr-2 h-4 w-4" />
        Script Podcast
      </Button>
      <div className="ml-auto flex items-center gap-2">
        {lastSavedAt && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Saved {new Date(lastSavedAt).toLocaleTimeString()}
          </span>
        )}
        <Button
          onClick={() => void onSaveDraft()}
          disabled={savingDraft}
          className="h-10 rounded-full bg-amber-300 px-4 text-slate-950 hover:bg-amber-200"
        >
          {savingDraft ? <Sparkles className="mr-2 h-4 w-4 animate-pulse" /> : <Save className="mr-2 h-4 w-4" />}
          Save Draft to KB
        </Button>
      </div>
    </div>
  );
}

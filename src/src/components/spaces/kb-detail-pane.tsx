import { Clock3, FolderPlus, MessageSquareQuote, Orbit, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RegistrySpace } from '@/store/kb-registry-store';

interface KbDetailPaneProps {
  selectedSpace: RegistrySpace | null;
  isCurrent: boolean;
  switching: boolean;
  onOpen: () => void;
  onRegisterCurrent: () => void;
  showRegisterCurrent: boolean;
  onOpenDocuments: () => void;
}

export function KbDetailPane({
  selectedSpace,
  isCurrent,
  switching,
  onOpen,
  onRegisterCurrent,
  showRegisterCurrent,
  onOpenDocuments,
}: KbDetailPaneProps) {
  if (!selectedSpace) {
    return (
      <div className="flex h-full items-center justify-center rounded-[2rem] border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm leading-7 text-slate-400">
        Select a space to inspect its metadata, browse documents, and open the chat panel.
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] border border-white/10 bg-black/20 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-400">
            <Orbit className="h-3.5 w-3.5" />
            Selected Space
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-white">{selectedSpace.name}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{selectedSpace.description}</p>
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-white/4 px-4 py-3 text-right text-sm">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Path</div>
          <div className="mt-2 max-w-[220px] break-all text-xs leading-6 text-slate-300">{selectedSpace.path}</div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.4rem] border border-white/10 bg-white/4 p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Documents</div>
          <div className="mt-3 text-2xl font-semibold text-white">{selectedSpace.stats?.frame_count ?? '—'}</div>
        </div>
        <div className="rounded-[1.4rem] border border-white/10 bg-white/4 p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Workflow</div>
          <div className="mt-3 flex items-center gap-2 text-sm text-emerald-300">
            <MessageSquareQuote className="h-4 w-4" />
            Ask, browse, switch
          </div>
        </div>
        <div className="rounded-[1.4rem] border border-white/10 bg-white/4 p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Registry</div>
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-300">
            <Clock3 className="h-4 w-4" />
            {isCurrent ? 'Active in app now' : selectedSpace.lastOpenedAt ? 'Opened before' : 'Saved for later'}
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          onClick={onOpen}
          disabled={switching}
          className="h-11 rounded-full bg-amber-300 px-5 text-sm font-medium text-slate-950 hover:bg-amber-200"
        >
          {switching ? 'Switching...' : isCurrent ? 'Open In Workbench' : 'Switch To This Space'}
        </Button>
        {showRegisterCurrent && (
          <Button
            onClick={onRegisterCurrent}
            variant="outline"
            className="h-11 rounded-full border-white/10 bg-white/4 px-5 text-sm text-white hover:bg-white/10"
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            Register Current KB
          </Button>
        )}
        <Button
          onClick={onOpenDocuments}
          variant="ghost"
          className="h-11 rounded-full px-5 text-sm text-slate-300 hover:bg-white/6 hover:text-white"
        >
          <Workflow className="mr-2 h-4 w-4" />
          Open Document Workspace
        </Button>
      </div>
    </div>
  );
}

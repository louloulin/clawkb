import { MessagesSquare, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useKbStore } from '@/store/kb-store';
import { useWorkspaceStore } from '@/store/workspace-store';

export function ChatPage() {
  const { setPage } = useKbStore();
  const { openExploreView } = useWorkspaceStore();

  return (
    <div className="flex h-full items-center justify-center bg-background p-8 text-foreground">
      <div className="max-w-xl rounded-[2rem] border border-border bg-muted/50 p-8 text-center backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-200/12 text-amber-100">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="mt-4 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Legacy Compatibility Entry</p>
        <h2 className="mt-5 text-2xl font-semibold">Chat has moved into the Workbench</h2>
        <p className="mt-4 text-sm leading-7 text-foreground/80">
          Workbench is the primary AI entry point for this personal, local knowledge base. Use it for model switching,
          library scope, attachments, and source previews.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            onClick={() => setPage('home')}
            className="h-11 rounded-full bg-amber-300 px-5 text-foreground hover:bg-amber-200"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Open Workbench
          </Button>
          <Button
            onClick={() => {
              openExploreView('search');
              setPage('explore');
            }}
            variant="outline"
            className="h-11 rounded-full border-border bg-secondary px-5 text-foreground hover:bg-accent"
          >
            <MessagesSquare className="mr-2 h-4 w-4" />
            Open Explore
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Legacy chat content is preserved through the same local chat history store.
        </p>
      </div>
    </div>
  );
}

import { ArrowRight, BookOpenText, LibraryBig, Mic, PenSquare, ScanSearch } from 'lucide-react';

type QuickAction = {
  id: 'voice-memo' | 'document-briefing' | 'smart-writing' | 'quick-access';
  title: string;
  description: string;
  icon: typeof LibraryBig;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'voice-memo',
    title: '录音纪要',
    description: 'Open media import and turn audio into knowledge.',
    icon: Mic,
  },
  {
    id: 'document-briefing',
    title: '文档解读',
    description: 'Jump into the document workspace for focused reading.',
    icon: ScanSearch,
  },
  {
    id: 'smart-writing',
    title: '智能写作',
    description: 'Open the draft lab inside the document workspace.',
    icon: PenSquare,
  },
  {
    id: 'quick-access',
    title: '快速访问',
    description: 'Move into local libraries and choose a different personal knowledge base.',
    icon: BookOpenText,
  },
] as const;

interface HomeQuickActionsProps {
  onAction: (action: QuickAction['id']) => void;
}

export function HomeQuickActions({ onAction }: HomeQuickActionsProps) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
      <div className="mb-4">
        <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Quick Actions</div>
        <h2 className="mt-2 text-xl font-semibold text-white">Jump into the next workflow immediately</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              className="group rounded-[1.25rem] border border-white/10 bg-black/20 p-4 text-left transition hover:border-amber-200/40 hover:bg-black/35"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8 text-amber-200">
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:text-amber-200" />
              </div>
              <div className="mt-4 text-base font-medium text-white">{action.title}</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{action.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

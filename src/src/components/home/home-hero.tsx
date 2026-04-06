import { BrainCircuit, Sparkles } from 'lucide-react';

interface HomeHeroProps {
  kbName: string;
  docCount: number;
}

export function HomeHero({ kbName, docCount }: HomeHeroProps) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-200/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-amber-100/80">
            <Sparkles className="h-3.5 w-3.5" />
            Workbench
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Ask, collect, and work through your personal knowledge without leaving the workspace.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            ClawKB is a personal, local-first knowledge base workbench. Start with a question, switch mode and model in context,
            choose the library you want, and branch straight into reading, import, or writing.
          </p>
        </div>

        <div className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-sm text-slate-200 sm:grid-cols-3 lg:min-w-[360px]">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Knowledge Base</div>
            <div className="mt-1 font-medium text-white">{kbName}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Documents</div>
            <div className="mt-1 font-medium text-white">{docCount}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Mode</div>
            <div className="mt-1 inline-flex items-center gap-2 font-medium text-emerald-300">
              <BrainCircuit className="h-4 w-4" />
              Chat-first
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

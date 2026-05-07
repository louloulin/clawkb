import { BrainCircuit, Sparkles } from 'lucide-react';

interface HomeHeroProps {
  kbName: string;
  docCount: number;
}

export function HomeHero({ kbName, docCount }: HomeHeroProps) {
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/6 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-200/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-amber-100/80">
            <Sparkles className="h-3.5 w-3.5" />
            问答
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            先问当前知识库，再继续笔记和写作。
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            默认只围绕一个本地知识库工作，少切页、少记概念，直接进入问答和笔记。
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-sm text-slate-200">
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2">
            知识库：{kbName}
          </span>
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2">
            资料：{docCount}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-emerald-300">
            <BrainCircuit className="h-4 w-4" />
            问答优先
          </span>
        </div>
      </div>
    </section>
  );
}

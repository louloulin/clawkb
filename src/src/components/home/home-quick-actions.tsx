import { ArrowRight, BookOpenText, FilePlus2, PenSquare, ScrollText } from 'lucide-react';

type QuickAction = {
  id: 'import-material' | 'open-notes' | 'continue-writing' | 'switch-library';
  title: string;
  description: string;
  icon: typeof BookOpenText;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'import-material',
    title: '导入资料',
    description: '把文件、文件夹或网页放进当前知识库。',
    icon: FilePlus2,
  },
  {
    id: 'open-notes',
    title: '打开笔记',
    description: '进入资料阅读和笔记工作区，继续整理当前内容。',
    icon: ScrollText,
  },
  {
    id: 'continue-writing',
    title: '继续写作',
    description: '基于当前资料延续草稿，不再跳去复杂工具页。',
    icon: PenSquare,
  },
  {
    id: 'switch-library',
    title: '切换知识库',
    description: '查看当前库和其他已保存知识库，继续在正确的资料上工作。',
    icon: BookOpenText,
  },
] as const;

interface HomeQuickActionsProps {
  onAction: (action: QuickAction['id']) => void;
  disabledActions?: QuickAction['id'][];
}

export function HomeQuickActions({ onAction, disabledActions = [] }: HomeQuickActionsProps) {
  return (
    <div className="rounded-[1.75rem] border border-border bg-muted/50 p-5 backdrop-blur-xl">
      <div className="mb-4">
        <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">常用动作</div>
        <h2 className="mt-2 text-xl font-semibold text-foreground">从当前知识库继续下一步</h2>
      </div>
      <div className="flex flex-wrap gap-3">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          const disabled = disabledActions.includes(action.id);
          return (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              disabled={disabled}
              className={`group min-w-[168px] flex-1 rounded-[1.1rem] border px-4 py-3 text-left transition ${
                disabled
                  ? 'cursor-not-allowed border-border bg-secondary/40 text-muted-foreground'
                  : 'border-border bg-secondary hover:border-amber-200/40 hover:bg-secondary/90'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                  disabled ? 'bg-secondary text-muted-foreground' : 'bg-muted text-amber-200'
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{action.title}</div>
                  <p className={`mt-1 text-xs leading-5 ${disabled ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                    {action.description}
                  </p>
                </div>
                <ArrowRight className={`h-4 w-4 shrink-0 transition ${
                  disabled ? 'text-muted-foreground/70' : 'text-muted-foreground group-hover:text-amber-200'
                }`} />
              </div>
              {disabled && (
                <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  先打开知识库
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

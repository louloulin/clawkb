import { useState } from 'react';
import { Loader2, MessageSquareQuote, Send, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, type ContextFragment } from '@/api';
import type { AskResult } from '@/api';
import type { RegistrySpace } from '@/store/kb-registry-store';

interface KbChatPaneProps {
  selectedSpace: RegistrySpace | null;
  isCurrent: boolean;
  onEnsureSpaceReady: () => Promise<void>;
  onOpenSource?: (fragment: ContextFragment) => void;
}

export function KbChatPane({
  selectedSpace,
  isCurrent,
  onEnsureSpaceReady,
  onOpenSource,
}: KbChatPaneProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AskResult | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async () => {
    if (!selectedSpace || !question.trim()) return;
    setAsking(true);
    setError(null);
    try {
      await onEnsureSpaceReady();
      const result = isCurrent
        ? await api.aiAsk(question, 6)
        : (await api.aiAskMulti(question, [selectedSpace.path], 6)).result;
      setAnswer(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setAsking(false);
    }
  };

  if (!selectedSpace) {
    return (
      <div className="rounded-[1.8rem] border border-dashed border-white/10 bg-black/20 p-5 text-sm leading-7 text-slate-400">
        先选择一个知识库。这里会变成“基于知识库提问”的入口，并显示当前资料预览。
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-[1.8rem] border border-white/10 bg-black/20">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-400">
          <MessageSquareQuote className="h-3.5 w-3.5" />
          基于知识库提问
        </div>
        <h3 className="mt-2 text-lg font-semibold text-white">围绕 {selectedSpace.name} 提问并查看资料</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          像 ima 一样，先选知识库，再围绕当前资料提问。资料浏览留在上方主区，底部只负责问答。
        </p>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="rounded-[1.25rem] border border-white/10 bg-white/4 p-3">
          <div className="flex gap-2">
            <Input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleAsk();
                }
              }}
              placeholder={`基于 ${selectedSpace.name} 提问…`}
              className="h-11 rounded-full border-white/10 bg-black/20 text-white placeholder:text-slate-500"
            />
            <Button
              onClick={() => void handleAsk()}
              disabled={!question.trim() || asking}
              aria-label="发送提问"
              className="h-11 rounded-full bg-amber-300 px-4 text-slate-950 hover:bg-amber-200"
            >
              {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-[1rem] border border-red-500/30 bg-red-500/10 p-4">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-300 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-red-300">提问失败</div>
                <div className="mt-1 text-xs text-red-400/70">{error}</div>
              </div>
              <button onClick={() => setError(null)} className="shrink-0 text-red-400/50 hover:text-red-300">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {answer && (
            <div className="mt-4 rounded-[1.1rem] border border-white/10 bg-black/20 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">最新回答</div>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-100">
                {answer.answer || '这次没有返回整理后的回答。'}
              </div>
              {answer.context.length > 0 && (
                <div className="mt-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">来源</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {answer.context.slice(0, 4).map((fragment) => (
                      <button
                        key={`${fragment.frame_id}-${fragment.rank}`}
                        type="button"
                        aria-label={`查看来源：${fragment.title || fragment.uri || '未命名资料'}`}
                        onClick={() => onOpenSource?.(fragment)}
                        className="rounded-[1rem] border border-white/10 bg-white/4 p-3 text-left transition hover:border-white/20 hover:bg-white/8"
                      >
                        <div className="text-sm font-medium text-white">
                          #{fragment.rank} {fragment.title || fragment.uri || '未命名资料'}
                        </div>
                        <div className="mt-2 line-clamp-3 text-xs leading-6 text-slate-400">{fragment.text}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

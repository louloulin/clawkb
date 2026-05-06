import { useMemo, useState } from 'react';
import { AtSign, ChevronDown, Link2, Loader2, Paperclip, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ASK_MODEL_OPTIONS, type AskModel } from '@/store/ai-store';
import type { ChatMessage, ChatMode, ContextFragment } from '@/api';

const MODE_OPTIONS: Array<{ value: ChatMode; label: string }> = [
  { value: 'conversation', label: '对话' },
  { value: 'research', label: '研究' },
  { value: 'context', label: '仅上下文' },
];

type MentionOption = {
  id: string;
  label: string;
  scopePaths: string[];
};

interface HomeComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  model: AskModel;
  onModelChange: (model: AskModel) => void;
  mention: string;
  onMentionChange: (mentionId: string) => void;
  mentionOptions: MentionOption[];
  onAttachmentIntent: (intent: 'file' | 'url' | 'media' | 'screenshot') => void;
  onOpenSource?: (fragment: ContextFragment) => void;
  latestAssistantMessage: ChatMessage | undefined;
}

export function HomeComposer({
  input,
  onInputChange,
  onSend,
  isLoading,
  mode,
  onModeChange,
  model,
  onModelChange,
  mention,
  onMentionChange,
  mentionOptions,
  onAttachmentIntent,
  onOpenSource,
  latestAssistantMessage,
}: HomeComposerProps) {
  const [showAdvanced, setShowAdvanced] = useState(
    mode !== 'conversation' || model !== 'default',
  );
  const selectedMention = useMemo(
    () => mentionOptions.find((option) => option.id === mention),
    [mention, mentionOptions],
  );

  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-black/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">问答</div>
          <div className="mt-2 text-base font-medium text-white">围绕当前知识库提问和整理笔记</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={mention} onValueChange={onMentionChange}>
            <SelectTrigger className="h-11 min-w-[180px] rounded-full border-white/10 bg-white/6 text-white">
              <SelectValue placeholder="知识库范围" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-slate-950 text-white">
              {mentionOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowAdvanced((current) => !current)}
            className="h-11 rounded-full border-white/10 bg-white/4 px-4 text-sm text-white hover:bg-white/10"
          >
            <ChevronDown className={`mr-2 h-4 w-4 transition ${showAdvanced ? 'rotate-180' : ''}`} />
            {showAdvanced ? '收起高级选项' : '显示高级选项'}
          </Button>
        </div>
      </div>

      {showAdvanced && (
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
          <Select value={mode} onValueChange={(value) => onModeChange(value as ChatMode)}>
            <SelectTrigger className="h-11 rounded-full border-white/10 bg-white/6 text-white">
              <SelectValue placeholder="问答模式" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-slate-950 text-white">
              {MODE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={model} onValueChange={(value) => onModelChange(value as AskModel)}>
            <SelectTrigger className="h-11 rounded-full border-white/10 bg-white/6 text-white">
              <SelectValue placeholder="模型" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-slate-950 text-white">
              {ASK_MODEL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <textarea
        value={input}
        onChange={(event) => onInputChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
        placeholder="基于当前知识库提问，或输入你要整理的笔记主题…"
        className="mt-4 min-h-[108px] w-full resize-none border-none bg-transparent text-base leading-7 text-white placeholder:text-slate-500 focus:outline-none"
      />

      <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
            <AtSign className="mr-1.5 inline h-3.5 w-3.5" />
            {selectedMention?.label ?? '@当前知识库'}
          </span>
          {showAdvanced && (
            <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
              <Sparkles className="mr-1.5 inline h-3.5 w-3.5" />
              {MODE_OPTIONS.find((option) => option.value === mode)?.label}
            </span>
          )}
          {showAdvanced && (
            <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
              {ASK_MODEL_OPTIONS.find((option) => option.value === model)?.label}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => onAttachmentIntent('file')}
              className="h-10 rounded-full border-white/10 bg-white/4 px-4 text-sm text-white hover:bg-white/10"
            >
              <Paperclip className="mr-2 h-4 w-4" />
              导入文件
            </Button>
            <Button
              variant="outline"
              onClick={() => onAttachmentIntent('url')}
              className="h-10 rounded-full border-white/10 bg-white/4 px-4 text-sm text-white hover:bg-white/10"
            >
              <Link2 className="mr-2 h-4 w-4" />
              网页
            </Button>
            {showAdvanced && (
              <Button
                variant="outline"
                onClick={() => onAttachmentIntent('media')}
                className="h-10 rounded-full border-white/10 bg-white/4 px-4 text-sm text-white hover:bg-white/10"
              >
                媒体
              </Button>
            )}
            {showAdvanced && (
              <Button
                variant="outline"
                onClick={() => onAttachmentIntent('screenshot')}
                className="h-10 rounded-full border-white/10 bg-white/4 px-4 text-sm text-white hover:bg-white/10"
              >
                截图
              </Button>
            )}
          </div>

          <Button
            onClick={onSend}
            disabled={!input.trim() || isLoading}
            className="h-11 rounded-full bg-amber-300 px-5 text-sm font-medium text-slate-950 hover:bg-amber-200"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            提问
          </Button>
        </div>

        {latestAssistantMessage && (
          <div className="rounded-[1.25rem] border border-white/10 bg-white/4 p-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">来源</div>
            {latestAssistantMessage.context && latestAssistantMessage.context.length > 0 ? (
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {latestAssistantMessage.context.slice(0, 4).map((fragment) => (
                  <button
                    key={`${fragment.frame_id}-${fragment.rank}`}
                    type="button"
                    aria-label={`查看来源：${fragment.title || fragment.uri || '未命名资料'}`}
                    onClick={() => onOpenSource?.(fragment)}
                    className="rounded-[1rem] border border-white/10 bg-black/20 p-3 text-left transition hover:border-white/20 hover:bg-black/30"
                  >
                    <div className="text-sm font-medium text-white">
                      #{fragment.rank} {fragment.title || fragment.uri || '未命名资料'}
                    </div>
                    <div className="mt-2 line-clamp-4 text-xs leading-6 text-slate-400">{fragment.text}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-[1rem] border border-dashed border-white/10 bg-black/20 px-4 py-4 text-sm leading-7 text-slate-400">
                这次回答没有返回明确来源片段。保留这个位置，是为了让基于资料的回答始终有稳定的来源区。
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

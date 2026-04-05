import { useMemo } from 'react';
import { AtSign, Loader2, Paperclip, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ASK_MODEL_OPTIONS, type AskModel } from '@/store/ai-store';
import type { ChatMessage, ChatMode } from '@/api';

const MODE_OPTIONS: Array<{ value: ChatMode; label: string }> = [
  { value: 'conversation', label: 'Conversation' },
  { value: 'research', label: 'Research' },
  { value: 'context', label: 'Context Only' },
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
  latestAssistantMessage,
}: HomeComposerProps) {
  const selectedMention = useMemo(
    () => mentionOptions.find((option) => option.id === mention),
    [mention, mentionOptions],
  );

  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-black/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
        <Select value={mode} onValueChange={(value) => onModeChange(value as ChatMode)}>
          <SelectTrigger className="h-11 rounded-full border-white/10 bg-white/6 text-white">
            <SelectValue placeholder="Mode" />
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
            <SelectValue placeholder="Model" />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-slate-950 text-white">
            {ASK_MODEL_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={mention} onValueChange={onMentionChange}>
          <SelectTrigger className="h-11 rounded-full border-white/10 bg-white/6 text-white">
            <SelectValue placeholder="Mention scope" />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-slate-950 text-white">
            {mentionOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <textarea
        value={input}
        onChange={(event) => onInputChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
        placeholder="Ask the workbench a question, or start a focused workflow…"
        className="mt-4 min-h-[128px] w-full resize-none border-none bg-transparent text-base leading-7 text-white placeholder:text-slate-500 focus:outline-none"
      />

      <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
            <Sparkles className="mr-1.5 inline h-3.5 w-3.5" />
            {MODE_OPTIONS.find((option) => option.value === mode)?.label}
          </span>
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
            <AtSign className="mr-1.5 inline h-3.5 w-3.5" />
            {selectedMention?.label ?? 'Current KB'}
          </span>
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
            {ASK_MODEL_OPTIONS.find((option) => option.value === model)?.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => onAttachmentIntent('file')}
              className="h-10 rounded-full border-white/10 bg-white/4 px-4 text-sm text-white hover:bg-white/10"
            >
              <Paperclip className="mr-2 h-4 w-4" />
              Attach File
            </Button>
            <Button
              variant="outline"
              onClick={() => onAttachmentIntent('url')}
              className="h-10 rounded-full border-white/10 bg-white/4 px-4 text-sm text-white hover:bg-white/10"
            >
              Web Link
            </Button>
            <Button
              variant="outline"
              onClick={() => onAttachmentIntent('media')}
              className="h-10 rounded-full border-white/10 bg-white/4 px-4 text-sm text-white hover:bg-white/10"
            >
              Voice Memo
            </Button>
            <Button
              variant="outline"
              onClick={() => onAttachmentIntent('screenshot')}
              className="h-10 rounded-full border-white/10 bg-white/4 px-4 text-sm text-white hover:bg-white/10"
            >
              Screenshot
            </Button>
          </div>

          <Button
            onClick={onSend}
            disabled={!input.trim() || isLoading}
            className="h-11 rounded-full bg-amber-300 px-5 text-sm font-medium text-slate-950 hover:bg-amber-200"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Ask Workbench
          </Button>
        </div>

        {latestAssistantMessage && (
          <div className="rounded-[1.25rem] border border-white/10 bg-white/4 p-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Source Preview</div>
            {latestAssistantMessage.context && latestAssistantMessage.context.length > 0 ? (
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {latestAssistantMessage.context.slice(0, 4).map((fragment) => (
                  <div key={`${fragment.frame_id}-${fragment.rank}`} className="rounded-[1rem] border border-white/10 bg-black/20 p-3">
                    <div className="text-sm font-medium text-white">
                      #{fragment.rank} {fragment.title || fragment.uri || 'Untitled'}
                    </div>
                    <div className="mt-2 line-clamp-4 text-xs leading-6 text-slate-400">{fragment.text}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-[1rem] border border-dashed border-white/10 bg-black/20 px-4 py-4 text-sm leading-7 text-slate-400">
                This response did not return explicit source fragments, but the preview rail stays visible so source-backed answers have a stable home in the workbench layout.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

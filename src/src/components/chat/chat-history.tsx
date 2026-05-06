import { useMemo } from 'react';
import { formatDistanceToNow } from '@/lib/date-utils';
import type { ChatMessage } from '@/api';

interface ChatHistoryProps {
  messages: ChatMessage[];
  visibleMessages: ChatMessage[];
}

export function ChatHistory({ visibleMessages }: ChatHistoryProps) {
  const grouped = useMemo(() => {
    const groups: { date: string; messages: ChatMessage[] }[] = [];
    let currentDate = '';
    let currentGroup: ChatMessage[] = [];

    for (const msg of visibleMessages) {
      const msgDate = new Date(msg.timestamp).toLocaleDateString('zh-CN');
      if (msgDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, messages: currentGroup });
        }
        currentDate = msgDate;
        currentGroup = [msg];
      } else {
        currentGroup.push(msg);
      }
    }
    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, messages: currentGroup });
    }
    return groups;
  }, [visibleMessages]);

  if (visibleMessages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-[48px] opacity-20 mb-3">💬</div>
        <p className="text-sm text-muted-foreground">还没有对话记录，开始提问吧</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map((group, gi) => (
        <div key={gi}>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 px-1">
            {group.date}
          </div>
          <div className="space-y-2">
            {group.messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-amber-300 text-slate-900 rounded-br-md'
            : isAssistant
            ? 'bg-white/8 text-slate-200 rounded-bl-md border border-white/10'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {message.citations && message.citations.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/10">
            <span className="text-[10px] text-muted-foreground">参考</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {message.citations.slice(0, 3).map((cite: { title?: string; uri?: string }, i: number) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-muted-foreground">
                  {cite.title?.slice(0, 20) || cite.uri?.slice(0, 20) || '文档'}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex items-end text-[10px] text-muted-foreground/60 shrink-0 pb-1">
          {formatDistanceToNow(new Date(message.timestamp))}
        </div>
      )}
    </div>
  );
}
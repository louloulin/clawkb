import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, BookOpen, ChevronDown, Loader2, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatStore } from '@/store/chat-store';
import { useKbStore } from '@/store/kb-store';
import type { ContextFragment } from '@/api';

export function ChatPage() {
  const { messages, isLoading, error, showSources, activeMessageId, sendMessage, clearHistory, toggleSources, loadHistory } = useChatStore();
  const { isKbOpen } = useKbStore();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load history on mount
  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    const q = input.trim();
    if (!q || isLoading) return;
    setInput('');
    await sendMessage(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeMessage = messages.find(m => m.id === activeMessageId);
  const activeContext = activeMessage?.context || [];

  return (
    <div className="flex h-full">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <ScrollArea className="flex-1">
          <div ref={scrollRef} className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Ask your knowledge base</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  {isKbOpen
                    ? 'Ask questions and get AI-powered answers based on your documents and notes.'
                    : 'Open a knowledge base first to start asking questions.'}
                </p>
                {!isKbOpen && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 bg-amber-500/10 px-3 py-1.5 rounded-lg">
                    No knowledge base open — running in demo mode
                  </p>
                )}
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
                  {['What documents do I have?', 'Summarize my recent notes', 'What are the main topics?'].map(q => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); inputRef.current?.focus(); }}
                      className="text-left text-xs px-3 py-2.5 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-transparent hover:border-border"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-3'
                  : 'bg-muted/50 rounded-2xl rounded-bl-md px-4 py-3'
                }`}>
                  {/* Content */}
                  <div className={`text-sm whitespace-pre-wrap leading-relaxed ${msg.role === 'user' ? '' : 'prose prose-sm dark:prose-invert max-w-none'}`}>
                    {msg.content}
                  </div>

                  {/* Source references for assistant messages */}
                  {msg.role === 'assistant' && msg.context && msg.context.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-border/30">
                      <button
                        onClick={() => toggleSources(msg.id)}
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline cursor-pointer"
                      >
                        <BookOpen className="h-3 w-3" />
                        {msg.context.length} source{msg.context.length > 1 ? 's' : ''}
                        <ChevronDown className={`h-3 w-3 transition-transform ${showSources && activeMessageId === msg.id ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted/50 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching knowledge base...
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex justify-center">
                <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-4 py-2 max-w-md">
                  {error}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="border-t bg-card/60 backdrop-blur-sm px-4 py-3">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isKbOpen ? 'Ask a question about your knowledge base...' : 'Ask a question (demo mode)...'}
                  className="w-full resize-none rounded-xl border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 min-h-[44px] max-h-[200px]"
                  rows={1}
                  disabled={isLoading}
                />
              </div>
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="h-11 w-11 rounded-xl shrink-0"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
              {messages.length > 0 && (
                <Button
                  onClick={clearHistory}
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-xl shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
              Powered by memvid-core RAG &middot; Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>

      {/* Source panel (collapsible right sidebar) */}
      {showSources && activeContext.length > 0 && (
        <div className="w-80 border-l bg-card/60 backdrop-blur-sm flex flex-col shrink-0">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-sm font-medium">Sources</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleSources()}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {activeContext.map((fragment: ContextFragment) => (
                <div
                  key={`${fragment.frame_id}-${fragment.rank}`}
                  className="p-3 rounded-lg bg-muted/40 border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs font-medium text-foreground truncate">
                      #{fragment.rank} {fragment.title || fragment.uri || 'Untitled'}
                    </span>
                    {fragment.score != null && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {(fragment.score * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-4 leading-relaxed">
                    {fragment.text}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

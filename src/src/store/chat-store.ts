import { create } from 'zustand';
import { api } from '@/api';
import type { ChatMessage, AskResult, ChatMode, ContextFragment, SearchHit } from '@/api';

const HISTORY_KEY = 'clawkb-chat-history';
const MAX_HISTORY = 100;

interface SendMessageOptions {
  mode?: ChatMode;
  modelLabel?: string;
  scopeLabel?: string;
  scopePaths?: string[];
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  showSources: boolean;
  activeMessageId: string | null;

  // Actions
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
  clearHistory: () => void;
  toggleSources: (messageId?: string) => void;
  loadHistory: () => void;
}

function hitsToContext(hits: SearchHit[]): ContextFragment[] {
  return hits.map((hit, index) => ({
    rank: index + 1,
    frame_id: hit.id,
    uri: hit.source || '',
    title: hit.title,
    score: hit.score,
    text: hit.content,
  }));
}

function contextToText(context: ContextFragment[]): string {
  if (context.length === 0) return 'No context fragments found for this request.';
  return context
    .map((fragment) => `#${fragment.rank} ${fragment.title || fragment.uri || 'Untitled'}\n${fragment.text.slice(0, 220)}`)
    .join('\n\n');
}

function loadFromStorage(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const msgs: ChatMessage[] = JSON.parse(raw);
    return msgs.slice(-MAX_HISTORY);
  } catch {
    return [];
  }
}

function saveToStorage(messages: ChatMessage[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
  } catch { /* ignore quota errors */ }
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  error: null,
  showSources: false,
  activeMessageId: null,

  loadHistory: () => {
    const messages = loadFromStorage();
    set({ messages });
  },

  sendMessage: async (content: string, options = {}) => {
    const mode = options.mode || 'conversation';
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      mode,
      modelLabel: options.modelLabel,
      scopeLabel: options.scopeLabel,
    };

    const prev = get().messages;
    const updated = [...prev, userMsg];
    set({ messages: updated, isLoading: true, error: null });
    saveToStorage(updated);

    try {
      let result: AskResult;

      if (options.scopePaths && options.scopePaths.length > 0) {
        for (const path of options.scopePaths) {
          await api.openExtraKb(path);
        }
      }

      if (mode === 'context') {
        if (options.scopePaths && options.scopePaths.length > 0) {
          const hits = await api.searchMultiKb(content, options.scopePaths, 8, 'hybrid');
          result = {
            answer: null,
            citations: [],
            context: hitsToContext(hits),
            retriever: 'hybrid',
            context_only: true,
          };
        } else {
          result = await api.aiAskContext(content, 8);
        }
      } else if (options.scopePaths && options.scopePaths.length > 0) {
        const prompt = mode === 'research'
          ? `${content}\n\nFocus on breadth, citations, and synthesis across the selected spaces.`
          : content;
        result = (await api.aiAskMulti(prompt, options.scopePaths, 8)).result;
      } else {
        const prompt = mode === 'research'
          ? `${content}\n\nFocus on a source-backed answer and highlight the strongest evidence.`
          : content;
        result = await api.aiAsk(prompt, 8);
      }

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-reply`,
        role: 'assistant',
        content: result.answer || contextToText(result.context),
        timestamp: new Date().toISOString(),
        mode,
        modelLabel: options.modelLabel,
        scopeLabel: options.scopeLabel,
        citations: result.citations,
        context: result.context,
      };

      const final = [...updated, assistantMsg];
      set({
        messages: final,
        isLoading: false,
        activeMessageId: assistantMsg.id,
        showSources: (assistantMsg.context?.length ?? 0) > 0,
      });
      saveToStorage(final);
    } catch (e) {
      set({ isLoading: false, error: String(e) });
    }
  },

  clearHistory: () => {
    set({ messages: [], error: null });
    localStorage.removeItem(HISTORY_KEY);
  },

  toggleSources: (messageId?: string) => {
    set((s) => ({
      showSources: !s.showSources,
      activeMessageId: messageId || s.activeMessageId,
    }));
  },
}));

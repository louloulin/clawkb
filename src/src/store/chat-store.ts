import { create } from 'zustand';
import { api } from '@/api';
import type { ChatMessage, AskResult } from '@/api';

const HISTORY_KEY = 'clawkb-chat-history';
const MAX_HISTORY = 100;

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  showSources: boolean;
  activeMessageId: string | null;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  clearHistory: () => void;
  toggleSources: (messageId?: string) => void;
  loadHistory: () => void;
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

  sendMessage: async (content: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    const prev = get().messages;
    const updated = [...prev, userMsg];
    set({ messages: updated, isLoading: true, error: null });
    saveToStorage(updated);

    try {
      const result: AskResult = await api.aiAsk(content, 8);

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-reply`,
        role: 'assistant',
        content: result.answer || 'No answer generated. See sources for relevant context.',
        timestamp: new Date().toISOString(),
        citations: result.citations,
        context: result.context,
      };

      const final = [...updated, assistantMsg];
      set({ messages: final, isLoading: false });
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

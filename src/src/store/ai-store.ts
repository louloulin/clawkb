import { create } from 'zustand';
import { api } from '@/api';

export type EmbeddingProvider = 'local' | 'openai' | 'custom';
export type AskModel = 'default' | 'gpt-4o-mini' | 'gpt-4o' | 'claude-3-haiku' | 'claude-3-sonnet' | 'custom';

interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  apiKey: string;
  apiBase: string;
}

interface AskConfig {
  model: AskModel;
  customModelName: string;
  temperature: number;
  topK: number;
}

interface AiConfigState {
  embedding: EmbeddingConfig;
  ask: AskConfig;
  isConfigured: boolean;

  // Actions
  setEmbeddingProvider: (provider: EmbeddingProvider) => void;
  setEmbeddingModel: (model: string) => void;
  setApiKey: (key: string) => void;
  setApiBase: (base: string) => void;
  setAskModel: (model: AskModel) => void;
  setCustomModelName: (name: string) => void;
  setTemperature: (temp: number) => void;
  setTopK: (k: number) => void;
  loadConfig: () => void;
  saveConfig: () => void;
  applyConfig: () => Promise<void>;
}

const STORAGE_KEY = 'clawkb-ai-config';

const defaultConfig = {
  embedding: {
    provider: 'local' as EmbeddingProvider,
    model: 'bge-small-en',
    apiKey: '',
    apiBase: 'https://api.openai.com/v1',
  },
  ask: {
    model: 'default' as AskModel,
    customModelName: '',
    temperature: 0.7,
    topK: 8,
  },
  isConfigured: false,
};

function loadFromStorage(): Partial<AiConfigState> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        embedding: { ...defaultConfig.embedding, ...parsed.embedding },
        ask: { ...defaultConfig.ask, ...parsed.ask },
        isConfigured: parsed.isConfigured || false,
      };
    }
  } catch {}
  return {};
}

export const useAiStore = create<AiConfigState>((set, get) => ({
  ...defaultConfig,
  ...loadFromStorage(),

  setEmbeddingProvider: (provider) => {
    set((s) => ({ embedding: { ...s.embedding, provider } }));
    get().saveConfig();
  },

  setEmbeddingModel: (model) => {
    set((s) => ({ embedding: { ...s.embedding, model } }));
    get().saveConfig();
  },

  setApiKey: (apiKey) => {
    set((s) => ({ embedding: { ...s.embedding, apiKey }, isConfigured: true }));
    get().saveConfig();
  },

  setApiBase: (apiBase) => {
    set((s) => ({ embedding: { ...s.embedding, apiBase } }));
    get().saveConfig();
  },

  setAskModel: (model) => {
    set((s) => ({ ask: { ...s.ask, model } }));
    get().saveConfig();
  },

  setCustomModelName: (customModelName) => {
    set((s) => ({ ask: { ...s.ask, customModelName } }));
    get().saveConfig();
  },

  setTemperature: (temperature) => {
    set((s) => ({ ask: { ...s.ask, temperature } }));
    get().saveConfig();
  },

  setTopK: (topK) => {
    set((s) => ({ ask: { ...s.ask, topK } }));
    get().saveConfig();
  },

  loadConfig: () => {
    const saved = loadFromStorage();
    set({ ...defaultConfig, ...saved });
  },

  saveConfig: () => {
    const { embedding, ask, isConfigured } = get();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ embedding, ask, isConfigured }));
    } catch {}
  },

  applyConfig: async () => {
    const { embedding, ask } = get();

    // Infer LLM provider from the selected model
    let llmProvider = 'local';
    let llmModel = ask.model === 'custom' ? ask.customModelName : ask.model;
    let llmApiKey = undefined;
    let llmApiBase = undefined;

    if (ask.model === 'gpt-4o-mini' || ask.model === 'gpt-4o') {
      llmProvider = 'openai';
      llmApiKey = embedding.apiKey || undefined;
      llmApiBase = embedding.apiBase || undefined;
    } else if (ask.model === 'claude-3-haiku' || ask.model === 'claude-3-sonnet') {
      llmProvider = 'anthropic';
      llmApiKey = embedding.apiKey || undefined;
      llmApiBase = embedding.apiBase || undefined;
    } else if (ask.model === 'custom') {
      llmProvider = 'custom';
      llmApiKey = embedding.apiKey || undefined;
      llmApiBase = embedding.apiBase || undefined;
    } else {
      // 'default' — local Ollama
      llmProvider = 'local';
    }

    try {
      await api.setEmbeddingModel(embedding.provider, embedding.model, embedding.apiKey || undefined, embedding.apiBase || undefined);
      await api.setAskModel(llmProvider, llmModel, llmApiKey, llmApiBase, ask.temperature);
      set({ isConfigured: true });
    } catch {
      // In browser mode, just mark as configured
      set({ isConfigured: true });
    }
  },
}));

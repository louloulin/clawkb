import { create } from 'zustand';
import { api } from '@/api';
import { STORAGE_KEYS, safeStorageGet, safeStorageSet } from '@/store/persistence';

export type EmbeddingProvider = 'local' | 'openai' | 'custom';
export type AskModel = 'default' | 'gpt-4o-mini' | 'gpt-4o' | 'claude-3-haiku' | 'claude-3-sonnet' | 'custom';

export const ASK_MODEL_OPTIONS: Array<{ value: AskModel; label: string }> = [
  { value: 'default', label: 'Local Default' },
  { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
  { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
  { value: 'custom', label: 'Custom Model' },
];

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

const STORAGE_KEY = STORAGE_KEYS.ai.config;

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
  const parsed = safeStorageGet<Partial<AiConfigState> | null>(STORAGE_KEY, null);
  if (parsed) {
    return {
      embedding: { ...defaultConfig.embedding, ...parsed.embedding },
      ask: { ...defaultConfig.ask, ...parsed.ask },
      isConfigured: parsed.isConfigured || false,
    };
  }
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
    safeStorageSet(STORAGE_KEY, { embedding, ask, isConfigured });
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

    await api.setEmbeddingModel(
      embedding.provider,
      embedding.model,
      embedding.apiKey || undefined,
      embedding.apiBase || undefined,
    );
    await api.setAskModel(llmProvider, llmModel, llmApiKey, llmApiBase, ask.temperature);
    set({ isConfigured: true });
  },
}));

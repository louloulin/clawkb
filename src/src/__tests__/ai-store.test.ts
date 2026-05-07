import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({
  setEmbeddingModel: vi.fn(),
  setAskModel: vi.fn(),
}));

vi.mock('@/api', () => ({
  api: apiMock,
}));

import { useAiStore } from '@/store/ai-store';

describe('ai store config application', () => {
  beforeEach(() => {
    apiMock.setEmbeddingModel.mockReset();
    apiMock.setAskModel.mockReset();
    useAiStore.setState({
      embedding: {
        provider: 'local',
        model: 'bge-small-en',
        apiKey: '',
        apiBase: 'https://api.openai.com/v1',
      },
      ask: {
        model: 'default',
        customModelName: '',
        temperature: 0.7,
        topK: 8,
      },
      isConfigured: false,
    });
  });

  it('keeps preview/runtime failures from masquerading as a saved AI config', async () => {
    apiMock.setEmbeddingModel.mockRejectedValueOnce(new Error('ClawKB desktop runtime required'));

    await expect(useAiStore.getState().applyConfig()).rejects.toThrow(
      'ClawKB desktop runtime required',
    );

    expect(useAiStore.getState().isConfigured).toBe(false);
    expect(apiMock.setAskModel).not.toHaveBeenCalled();
  });

  it('marks the config ready only after both desktop commands succeed', async () => {
    apiMock.setEmbeddingModel.mockResolvedValueOnce(undefined);
    apiMock.setAskModel.mockResolvedValueOnce(undefined);

    await expect(useAiStore.getState().applyConfig()).resolves.toBeUndefined();

    expect(useAiStore.getState().isConfigured).toBe(true);
    expect(apiMock.setEmbeddingModel).toHaveBeenCalledTimes(1);
    expect(apiMock.setAskModel).toHaveBeenCalledTimes(1);
  });
});

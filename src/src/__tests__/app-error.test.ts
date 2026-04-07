import { describe, expect, it } from 'vitest';
import { classifyAppError, userInputError } from '@/lib/app-error';

describe('app error classification', () => {
  it('classifies empty input as a user action issue', () => {
    const error = userInputError('Enter a knowledge base path before continuing.');

    expect(error.kind).toBe('user');
    expect(error.title).toBe('User action needed');
  });

  it('classifies runtime limitations separately from system failures', () => {
    const error = classifyAppError('OCR only available in Tauri mode', {
      fallback: 'This action is only available in the desktop app.',
    });

    expect(error.kind).toBe('runtime');
    expect(error.title).toBe('Desktop runtime required');
  });

  it('rewrites raw backend errors into user-facing guidance', () => {
    const error = classifyAppError('Knowledge base not open', {
      fallback: 'Open a local knowledge base before running this action.',
    });

    expect(error.kind).toBe('user');
    expect(error.description).toContain('Open a local knowledge base');
  });
});

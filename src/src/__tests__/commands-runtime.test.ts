import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '@/api';

describe('desktop-only command bridge', () => {
  beforeEach(() => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it('rejects KB open outside the desktop runtime', async () => {
    await expect(api.openKb('/tmp/test.mv2')).rejects.toThrow(
      'ClawKB desktop runtime required',
    );
  });

  it('rejects search outside the desktop runtime', async () => {
    await expect(api.search('weekly notes')).rejects.toThrow(
      'ClawKB desktop runtime required',
    );
  });
});

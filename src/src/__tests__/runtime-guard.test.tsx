import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '@/App';
import { getRuntimeMode, getRuntimeModeInfo } from '@/api/platform';
import { useKbStore } from '@/store/kb-store';

describe('runtime guard', () => {
  beforeEach(() => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    useKbStore.setState({
      stats: null,
      kbPath: '',
      isKbOpen: false,
      isLoading: false,
      error: null,
      currentPage: 'home',
      sidebarCollapsed: true,
      selectedDocument: null,
      detailLoading: false,
      darkMode: true,
    });
  });

  it('marks plain browser sessions as preview-only instead of desktop-local', () => {
    expect(getRuntimeMode()).toBe('browser-unsupported');
    expect(getRuntimeModeInfo().title).toContain('Browser Preview');
  });

  it('renders a runtime gate instead of pretending the browser can open a KB', () => {
    render(<App />);

    expect(screen.getByText('Desktop runtime required')).toBeInTheDocument();
    expect(screen.getByText(/opening or creating a kb, import, search, ocr, sync/i)).toBeInTheDocument();
    expect(useKbStore.getState().isKbOpen).toBe(false);
  });
});

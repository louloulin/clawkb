/**
 * Platform detection utility for ClawKB.
 * Determines whether the app runs inside Tauri webview or a regular browser.
 */

let _isTauri: boolean | null = null;

export function isTauri(): boolean {
  if (_isTauri !== null) return _isTauri;
  _isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  return _isTauri;
}

export function getPlatform(): 'tauri' | 'browser' {
  return isTauri() ? 'tauri' : 'browser';
}

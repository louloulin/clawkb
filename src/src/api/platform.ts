/**
 * Platform detection utility for ClawKB.
 * Determines whether the app runs inside Tauri webview or a regular browser.
 */

export type RuntimeMode = 'desktop-local' | 'browser-unsupported';

export type RuntimeModeInfo = {
  mode: RuntimeMode;
  badge: string;
  title: string;
  summary: string;
  dataSource: string;
  placeholderInteractions: string[];
  realInteractions: string[];
};

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function getPlatform(): 'tauri' | 'browser' {
  return isTauri() ? 'tauri' : 'browser';
}

export function getRuntimeMode(): RuntimeMode {
  return isTauri() ? 'desktop-local' : 'browser-unsupported';
}

export function isBrowserPreview(): boolean {
  return getRuntimeMode() === 'browser-unsupported';
}

const RUNTIME_MODE_INFO: Record<RuntimeMode, RuntimeModeInfo> = {
  'desktop-local': {
    mode: 'desktop-local',
    badge: 'Desktop Local',
    title: 'Desktop Local Runtime',
    summary: 'Primary product mode. Commands execute through the Tauri bridge and operate on your local knowledge base files.',
    dataSource: 'Real local KB files, Tauri command bridge, and on-device storage',
    placeholderInteractions: [],
    realInteractions: [
      'Open or create a real .mv2 knowledge base on disk',
      'Run imports, OCR, search, and sync through native commands',
      'Persist product state for day-to-day single-user local work',
    ],
  },
  'browser-unsupported': {
    mode: 'browser-unsupported',
    badge: 'Preview Only',
    title: 'Browser Preview Runtime',
    summary: 'ClawKB ships as a local desktop app. Browser sessions are limited to preview and verification, not real knowledge-base operations.',
    dataSource: 'Static preview shell only. No local KB file bridge is available in a plain browser session.',
    placeholderInteractions: [
      'Opening, creating, importing, searching, syncing, and OCR all require the Tauri desktop runtime',
      'No sample KB, placeholder notes, or browser-side fallback data are injected',
      'Use the desktop build when you need real local file access',
    ],
    realInteractions: [
      'Visual verification of the runtime guard and desktop-first product messaging',
      'Basic shell rendering used by automated preview checks',
    ],
  },
};

export function getRuntimeModeInfo(mode: RuntimeMode = getRuntimeMode()): RuntimeModeInfo {
  return RUNTIME_MODE_INFO[mode];
}

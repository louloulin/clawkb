# Runtime Modes

## Goal

ClawKB ships as a personal desktop knowledge base. Browser access now exists only for preview-time verification of runtime messaging, not as a fake product mode.

## Modes

### Desktop Local

- Primary delivery mode
- Runs inside the Tauri shell
- Calls the real Rust command bridge
- Operates on local `.mv2` knowledge base files
- Supports native-only actions such as OCR, WebDAV config persistence, and real file-system imports

### Browser Preview

- Development and verification mode only
- Runs without the Tauri bridge
- Shows a runtime guard instead of fake KB data
- Makes the desktop-only boundary explicit before release
- Must not be mistaken for the shipped desktop runtime

## What Is Real In Browser Preview

- Runtime messaging and desktop-first product copy
- Automated browser checks that verify the preview guard renders correctly
- Fast review of the non-desktop experience so it never pretends to be usable

## What Is Not Available In Browser Preview

- Opening or creating a KB
- Search, ask, export, import, OCR, sync, and multi-KB flows
- Any operation that depends on the native file system or Tauri command bridge

## Code Boundaries

- `src/src/api/platform.ts`: runtime mode detection and shared runtime metadata
- `src/src/api/commands.ts`: desktop-only command bridge with no browser fallback data
- `src/src/App.tsx`: preview guard screen for non-Tauri sessions
- `src/src/components/pages/settings.tsx`: runtime explanation for developers and reviewers when running in desktop mode

## Verification

- Run `cd src && npm run build`
- Run `bash scripts/verify-runtime-modes.sh`
- In browser preview confirm the page shows `Desktop runtime required` and `Preview Only`
- In desktop mode confirm native actions go through the Tauri bridge

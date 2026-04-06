# Local State Model

## Goal

ClawKB is a personal, local-first knowledge base, so browser-side persistence must be explicit, predictable, and limited to data that genuinely benefits from local recovery.

## Centralized Keys

All browser-side persistence keys are now declared in `src/src/store/persistence.ts`.

### User data

- `clawkb-chat-history`
- `clawkb-bookmarks`
- `clawkb-reading-progress`
- `clawkb-highlights`
- `clawkb-document-workspace`
- `clawkb-multi-kb`

### UI preferences

- `clawkb-last-kb-path`
- `clawkb-dark`
- `clawkb-ai-config`
- `clawkb-workspace`

### Integration config

- `clawkb-sync`

### Demo/development-only cache

- `clawkb-browser-folders`

## Rules

1. New browser persistence must go through `safeStorageGet`, `safeStorageSet`, `safeStorageSetString`, or `safeStorageRemove`.
2. New keys must be added to `STORAGE_KEYS` before use.
3. User data and demo-only caches must not share keys.
4. Local persistence should prefer small, restorable state over duplicated content blobs.

## Recovery expectations

- Reopening the app should preserve the last KB path, theme, workbench state, and chat history.
- Reopening the document workspace should preserve the current draft and last saved timestamp.
- Reader bookmarks, highlights, and reading progress should restore without manual steps.
- Browser demo folders are disposable and exist only to keep browser-mode verification realistic.

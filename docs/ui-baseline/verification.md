# UI Verification

Verification date: 2026-04-07

## Baseline screenshots

- `docs/ui-baseline/workbench-home.png`
- `docs/ui-baseline/spaces-registry.png`
- `docs/ui-baseline/document-workspace.png`

## Workflow checks

These checks were executed against the current app baseline:

1. Browser preview guard:
   The browser build stopped at `Desktop runtime required` and clearly indicated that real KB work requires the Tauri desktop app.
2. Desktop window launch:
   `scripts/verify-desktop-ui.sh` observed one `ClawKB — Personal Knowledge Base` window and captured a desktop screenshot artifact.
3. Persistence regression:
   `scripts/verify-local-state.sh` passed, confirming workspace and draft state are written to the expected local storage keys.
4. Release gate:
   `scripts/verify-release.sh` passed end-to-end with Rust tests, frontend smoke, preview verification, persistence verification, and desktop UI launch.

## Asset cleanup

- Legacy top-level exploratory screenshots were moved into `docs/ui-baseline/archive/`.
- The repo now keeps a single current screenshot baseline directory for the active product direction.

# UI Verification

Verification date: 2026-04-10

## Baseline screenshots

- `docs/ui-baseline/workbench-home.png`
- `docs/ui-baseline/spaces-registry.png`
- `docs/ui-baseline/document-workspace.png`

## Workflow checks

These checks were executed against the current app baseline:

1. Browser preview guard:
   `scripts/verify-runtime-modes.sh` rendered the preview shell in headless Chrome and confirmed `data-runtime-mode="browser-unsupported"`, `Desktop runtime required`, and `Preview Only`.
2. Desktop window launch:
   `scripts/verify-desktop-ui.sh` observed one `ClawKB — Personal Knowledge Base` window, captured a window-scoped screenshot artifact at logical bounds `1200x800`, recorded the Retina capture scale as `2`, and rejected black-screen captures until the real UI rendered.
3. No-KB onboarding UI:
   The live desktop screenshot showed the new `Workbench` setup panel and the product no longer pretended chat or document workflows were ready before a real local KB was mounted.
4. Persistence regression:
   `scripts/verify-local-state.sh` passed, confirming workspace and draft state are written to the expected local storage keys.
5. Release gate:
   `scripts/verify-release.sh` passed end-to-end with Rust tests, frontend smoke, preview verification, persistence verification, error-handling verification, and desktop UI launch.

## Asset cleanup

- Legacy top-level exploratory screenshots were moved into `docs/ui-baseline/archive/`.
- The repo now keeps a single current screenshot baseline directory for the active product direction.

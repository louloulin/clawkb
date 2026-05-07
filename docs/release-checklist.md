# Release Checklist

## Goal

Before calling ClawKB release-ready, the team should be able to run one command for the automated baseline and then verify a short, explicit set of manual checks.

## Automated Baseline

Run:

```bash
bash scripts/verify-release.sh
```

This release gate currently includes:

- `cargo test`
- `cd src && npm test`
- `cd src && npm run build`
- `bash scripts/verify-runtime-modes.sh`
- `bash scripts/verify-local-state.sh`
- `bash scripts/verify-error-handling.sh`
- `bash scripts/verify-desktop-ui.sh`

The automated gate now also:

- Reuses a locally installed `onnxruntime` dynamic library when available, so desktop verification does not stall on first-run ORT downloads
- Captures a window-scoped desktop screenshot with bounds and Retina scale metadata, instead of a whole-screen screenshot
- Rejects black or blank desktop captures by checking screenshot brightness and variance before treating the UI as verified
- Uses headless Chrome for preview-guard verification, so runtime-mode checks no longer depend on transient Playwright package injection

## Manual Checks Before Shipping

### Desktop local runtime

- Open the Tauri app and confirm the desktop window appears with the expected title
- Open an existing `.mv2` KB and create a new local KB
- Import one real local document and confirm it appears in search results
- Open the document workspace and save one draft back into the KB

### Browser preview guardrails

- Open the browser build and confirm it stops at `Desktop runtime required`
- Confirm the page explains that real KB work requires the Tauri desktop app

### Product sanity

- Check `Workbench`, `Spaces`, `Documents`, `Explore`, and `Settings` all load without layout breakage
- Confirm `Workbench` and `Documents` show real onboarding guidance instead of pseudo-usable empty states when no KB is open
- Confirm mention scope, space metadata editing, and document workspace draft flow still behave as expected
- Confirm local-first copy still describes the product as a personal desktop knowledge base

## Blocking Conditions

Do not call a build release-ready if any of the following are true:

- `scripts/verify-release.sh` fails
- New tests are added without being part of `cargo test` or `npm test`
- Browser preview behavior is mistaken for desktop product behavior in UI copy or verification notes
- Critical local workflows require manual guesswork to verify

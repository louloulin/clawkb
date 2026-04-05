# Phase 6 Verification

Verification date: 2026-04-06

## Baseline screenshots

- `docs/ui-baseline/workbench-home.png`
- `docs/ui-baseline/spaces-registry.png`
- `docs/ui-baseline/document-workspace.png`

## Workflow checks

These flows were executed against the running app in browser mode and verified end-to-end:

1. Open KB:
   The workbench loaded with `clawkb-demo`.
2. Search and open document:
   Search returned `Rust Performance Notes`.
3. Ask in KB space:
   The space console returned an answer in the selected KB space.
4. Import file and continue asking:
   Importing `/tmp/phase6-note.md` added a demo document and the follow-up ask surfaced that import title.
5. Open document and edit save:
   The document workspace opened, draft mode saved to the KB, and the saved badge appeared.

## Asset cleanup

- Legacy top-level exploratory screenshots were moved into `docs/ui-baseline/archive/`.
- The repo now keeps a single current screenshot baseline directory for the active product direction.

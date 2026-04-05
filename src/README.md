# ClawKB Frontend

ClawKB is a local-first knowledge base app built with React, TypeScript, Vite, and Tauri.

## Current Scope

The frontend currently exposes these stable surfaces:

- `Dashboard`
- `Search`
- `Chat`
- `Reader`
- `Notes`
- `Import`
- `Timeline`
- `Tags`
- `Graph`
- `Settings`

These surfaces still exist in the codebase, but are not treated as production-ready yet:

- `Editor`: AI assistance is still a mock flow and is not wired to real document persistence.
- `Entities`: the page does not yet use the real entity pipeline end to end.
- `Folders`: the sidebar folder tree is temporarily hidden because it still depends on demo metadata.

## Development

```bash
npm install
npm run dev
```

Default local URL:

```text
http://127.0.0.1:5173
```

## Verification

```bash
npm run build
```

## Tauri Integration

When the app runs inside Tauri, it tries to open the last-used knowledge base path first.
If no previous path is stored, it falls back to:

```text
$HOME/.clawkb/knowledge.mv2
```

## Known Limitations

- Browser mode still uses demo data for many data-heavy capabilities.
- The new workbench shell and knowledge-space model from `plan3.md` are not implemented yet.
- Some generation-heavy flows still need to be consolidated into the future document workspace.

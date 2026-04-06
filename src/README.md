# ClawKB Frontend

ClawKB is a local-first knowledge base app built with React, TypeScript, Vite, and Tauri.

## Product Positioning

ClawKB is now positioned as a personal, local-first knowledge base for a single user.
The product direction is:

- local knowledge only
- simple library selection
- AI-first ask / read / write workflows
- no cloud dependency required

## Current Shells

The current app is organized around these production-facing shells:

- `Workbench`
- `Spaces`
- `Documents`
- `Explore`
- `Settings`

Inside those shells, the app already supports:

- search
- import
- notes
- timeline
- tags
- entities
- graph
- report generation
- podcast script generation

## Legacy Entry Points

Two older page ids still exist for compatibility with historical navigation state:

- `Dashboard`: legacy landing page, superseded by `Workbench`
- `Chat`: legacy chat route, superseded by `Workbench`

They are intentionally no longer primary product entry points.

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
- The current product is intentionally single-user and local; collaboration and cloud sharing are out of scope.
- Some internal compatibility pages remain in the codebase while the product is being hardened.

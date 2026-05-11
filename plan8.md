# ClawKB 3.0 Core Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `kb3.0.md` analysis into an executable 3.0 refactor that makes ClawKB feel like a focused AI-first local knowledge workbench instead of a set of loosely connected feature pages.

**Architecture:** Keep the existing React + Zustand + Tauri command bridge. Introduce a thin product-domain layer and route the UI around four stable surfaces: Workbench, Library, Workspace, and Settings. Do not rewrite storage or backend first; make the main user loop observable and testable before deeper MV2/Vault changes.

**Tech Stack:** React 19, TypeScript, Vite, Zustand, Tauri v2 command bridge, Vitest, Testing Library, existing shadcn/Radix-style components.

---

## 0. Reference Documents

- Primary analysis: `kb3.0.md`
- Current positioning: `docs/product-positioning.md`
- Runtime model: `docs/runtime-modes.md`
- Local state model: `docs/local-state-model.md`
- Existing UI plan: `plan3.md`

---

## 1. Target Product Shape

3.0 should converge the app into four user-facing surfaces:

```text
Workbench
├── Ask current KB
├── Continue working
├── Recent sources / notes
└── Quick actions

Library
├── Tree / spaces
├── Search
├── Tags / Timeline / Graph as analysis views
└── Import entry

Workspace
├── Reader
├── Notes / Draft
├── Inspector
└── Source evidence

Settings
├── KB
├── AI
├── Import / Sync
├── Backup / Recovery
└── Labs
```

The first release of 3.0 should prioritize this loop:

```text
Open KB → Import/Search/Ask → Open source → Read/Ask selection → Save note/draft → Re-index/Resume
```

---

## 2. Files To Modify Or Create

### Product and Domain Layer

- Create: `src/src/domain/navigation.ts`
  - Defines the canonical 3.0 surfaces, view ids, labels, and routing helpers.
- Create: `src/src/domain/workflow.ts`
  - Defines domain types for workflow actions: `OpenSourceAction`, `SaveEvidenceAction`, `ContinueWorkingItem`, `SearchResultAction`.
- Modify: `src/src/store/workspace-store.ts`
  - Aligns workspace state with Workbench / Library / Workspace concepts.
- Modify: `src/src/store/document-workspace-store.ts`
  - Makes reader-to-draft flow explicit and testable.

### Shells and Navigation

- Modify: `src/src/App.tsx`
  - Routes legacy page ids into the new four-surface model without breaking saved state.
- Modify: `src/src/components/layout.tsx`
  - Updates navigation labels and grouping.
- Modify: `src/src/components/shell/workbench-shell.tsx`
  - Focuses homepage on Ask, continue working, recent items, and quick actions.
- Modify: `src/src/components/shell/explore-shell.tsx`
  - Reframes Explore as Library and de-emphasizes unrelated feature competition.
- Modify: `src/src/components/shell/document-workspace-shell.tsx`
  - Makes Workspace the primary reader/draft/notes surface.

### Core Flow Pages

- Modify: `src/src/components/pages/search.tsx`
  - Adds unified result actions: open, preview, cite/save, ask with source.
- Modify: `src/src/components/pages/reader.tsx`
  - Adds extraction/evidence save flow and clearer source/annotation panels.
- Modify: `src/src/components/pages/editor.tsx`
  - Keeps existing slash/link features but aligns save and backlink behavior with Workspace.
- Modify: `src/src/components/pages/notes.tsx`
  - Reduces duplicate editor semantics and supports Workspace draft save flow.
- Modify: `src/src/components/pages/settings.tsx`
  - Moves Obsidian/WebDAV/backup sections into clearer 3.0 groups.

### Tests

- Create: `src/src/__tests__/domain-navigation.test.ts`
- Create: `src/src/__tests__/core-workflow.test.tsx`
- Modify: `src/src/__tests__/app-shell-routing.test.tsx`
- Modify: `src/src/__tests__/workbench-shell.test.tsx`
- Modify: `src/src/__tests__/document-workspace-shell.test.tsx`
- Modify: `src/src/__tests__/search-page-flow.test.tsx`
- Modify: `src/src/__tests__/store-persistence.test.ts`

### Documentation

- Create: `docs/product-architecture-3.0.md`
- Create: `docs/domain-model-3.0.md`
- Modify: `src/README.md`
- Modify: `docs/release-checklist.md`

---

## 3. Implementation Tasks

### Task 1: Add Canonical 3.0 Navigation Model

**Files:**
- Create: `src/src/domain/navigation.ts`
- Create: `src/src/__tests__/domain-navigation.test.ts`
- Modify: `src/src/App.tsx`

- [ ] **Step 1: Write navigation tests**

Create `src/src/__tests__/domain-navigation.test.ts` with tests for:

```ts
import { getSurfaceForPage, isLegacyPageId, SURFACES } from '@/domain/navigation';

describe('3.0 navigation model', () => {
  it('maps primary pages into canonical surfaces', () => {
    expect(getSurfaceForPage('home').id).toBe('workbench');
    expect(getSurfaceForPage('documents').id).toBe('library');
    expect(getSurfaceForPage('reader').id).toBe('workspace');
    expect(getSurfaceForPage('settings').id).toBe('settings');
  });

  it('keeps legacy page ids routable', () => {
    expect(isLegacyPageId('dashboard')).toBe(true);
    expect(isLegacyPageId('chat')).toBe(true);
    expect(getSurfaceForPage('dashboard').id).toBe('workbench');
    expect(getSurfaceForPage('chat').id).toBe('workbench');
  });

  it('exposes exactly four top-level surfaces', () => {
    expect(SURFACES.map((surface) => surface.id)).toEqual([
      'workbench',
      'library',
      'workspace',
      'settings',
    ]);
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `rtk npm run test -- --run src/src/__tests__/domain-navigation.test.ts`

Expected: fails because `@/domain/navigation` does not exist.

- [ ] **Step 3: Implement navigation model**

Create `src/src/domain/navigation.ts`:

```ts
export type SurfaceId = 'workbench' | 'library' | 'workspace' | 'settings';

export interface AppSurface {
  id: SurfaceId;
  label: string;
  description: string;
  primaryPage: string;
  pageIds: string[];
}

export const SURFACES: AppSurface[] = [
  {
    id: 'workbench',
    label: 'Workbench',
    description: 'Ask, resume, and start focused knowledge work.',
    primaryPage: 'home',
    pageIds: ['home', 'dashboard', 'chat'],
  },
  {
    id: 'library',
    label: 'Library',
    description: 'Browse, import, search, and analyze knowledge sources.',
    primaryPage: 'documents',
    pageIds: ['documents', 'explore', 'search', 'import', 'tags', 'timeline', 'graph', 'entities', 'mindmap', 'report', 'podcast'],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    description: 'Read, annotate, draft, and save notes from sources.',
    primaryPage: 'reader',
    pageIds: ['reader', 'editor', 'notes'],
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Configure KB, AI, sync, backup, and labs.',
    primaryPage: 'settings',
    pageIds: ['settings'],
  },
];

export const LEGACY_PAGE_IDS = new Set(['dashboard', 'chat']);

export function isLegacyPageId(pageId: string) {
  return LEGACY_PAGE_IDS.has(pageId);
}

export function getSurfaceForPage(pageId: string): AppSurface {
  return SURFACES.find((surface) => surface.pageIds.includes(pageId)) ?? SURFACES[0];
}
```

- [ ] **Step 4: Wire App shell names conservatively**

In `src/src/App.tsx`, import `getSurfaceForPage` and derive the current surface near `currentPage`. Do not change page routing yet. Use the value only for `data-surface` on the root app container.

- [ ] **Step 5: Run targeted tests**

Run: `rtk npm run test -- --run src/src/__tests__/domain-navigation.test.ts src/src/__tests__/app-shell-routing.test.tsx`

Expected: PASS.

---

### Task 2: Stabilize Workspace Store Around The Core Loop

**Files:**
- Create: `src/src/domain/workflow.ts`
- Modify: `src/src/store/document-workspace-store.ts`
- Modify: `src/src/__tests__/store-persistence.test.ts`

- [ ] **Step 1: Add failing persistence test**

Extend `src/src/__tests__/store-persistence.test.ts` with a test that verifies draft recovery stores:

- active tab
- draft title
- draft content
- last selected source id/title
- last saved timestamp

- [ ] **Step 2: Run test and verify failure**

Run: `rtk npm run test -- --run src/src/__tests__/store-persistence.test.ts`

Expected: FAIL because selected source recovery is incomplete or implicit.

- [ ] **Step 3: Add workflow domain types**

Create `src/src/domain/workflow.ts`:

```ts
export interface SourceReference {
  id: string;
  title: string;
  source?: string;
  snippet?: string;
}

export interface ContinueWorkingItem {
  id: string;
  kind: 'source' | 'draft' | 'note' | 'query';
  title: string;
  subtitle?: string;
  updatedAt?: string;
}

export interface SearchResultAction {
  id: 'open' | 'preview' | 'cite' | 'ask';
  label: string;
}

export const SEARCH_RESULT_ACTIONS: SearchResultAction[] = [
  { id: 'open', label: 'Open' },
  { id: 'preview', label: 'Preview' },
  { id: 'cite', label: 'Save citation' },
  { id: 'ask', label: 'Ask with source' },
];
```

- [ ] **Step 4: Make selected source explicit**

In `src/src/store/document-workspace-store.ts`:

- Add `selectedSourceRef: SourceReference | null`
- Set it in `selectDocument`
- Persist it in `partialize`
- Use it when building draft title/content after reload

- [ ] **Step 5: Run targeted tests**

Run: `rtk npm run test -- --run src/src/__tests__/store-persistence.test.ts src/src/__tests__/document-workspace-shell.test.tsx`

Expected: PASS.

---

### Task 3: Refocus Workbench Around Ask And Continue Working

**Files:**
- Modify: `src/src/components/shell/workbench-shell.tsx`
- Modify: `src/src/components/home/home-composer.tsx`
- Modify: `src/src/components/home/home-quick-actions.tsx`
- Modify: `src/src/__tests__/workbench-shell.test.tsx`
- Modify: `src/src/__tests__/home-quick-actions.test.tsx`

- [ ] **Step 1: Add failing Workbench test**

Update `workbench-shell.test.tsx` so open-KB state expects:

- heading includes `Workbench`
- Ask panel remains primary
- `Continue working` region is visible
- recent/current KB strip remains compact
- import/search/new note/daily note quick actions remain visible

- [ ] **Step 2: Run targeted test**

Run: `rtk npm run test -- --run src/src/__tests__/workbench-shell.test.tsx src/src/__tests__/home-quick-actions.test.tsx`

Expected: FAIL for missing `Continue working` or label mismatches.

- [ ] **Step 3: Update Workbench copy and layout**

In `workbench-shell.tsx`:

- Rename visible shell heading to `Workbench`
- Add a compact `Continue working` section above or beside source cards
- Keep Ask composer as the dominant interaction
- Keep AI/provider advanced controls collapsed by default
- Do not add new dependencies

- [ ] **Step 4: Re-run targeted tests**

Run: `rtk npm run test -- --run src/src/__tests__/workbench-shell.test.tsx src/src/__tests__/home-composer.test.tsx src/src/__tests__/home-quick-actions.test.tsx`

Expected: PASS.

---

### Task 4: Reframe Explore Shell As Library

**Files:**
- Modify: `src/src/components/shell/explore-shell.tsx`
- Modify: `src/src/components/pages/search.tsx`
- Modify: `src/src/__tests__/explore-shell.test.tsx`
- Modify: `src/src/__tests__/search-page-flow.test.tsx`

- [ ] **Step 1: Add failing Library shell test**

Update `explore-shell.test.tsx` to assert:

- shell label is `Library`
- search and import are primary actions
- tags/timeline/entities/graph are grouped as analysis views
- report/podcast are not presented as first-order core navigation

- [ ] **Step 2: Run test and verify failure**

Run: `rtk npm run test -- --run src/src/__tests__/explore-shell.test.tsx`

Expected: FAIL on old labels/grouping.

- [ ] **Step 3: Update Explore shell labels and grouping**

In `explore-shell.tsx`:

- Rename shell heading to `Library`
- Group nav tabs into: `Core`, `Analysis`, `Generated`
- Keep page ids stable to avoid breaking saved state
- De-emphasize report/podcast visually as generated outputs

- [ ] **Step 4: Add search result action affordances**

In `search.tsx`:

- Keep existing result open behavior
- Add visible secondary actions: `Preview`, `Save citation`, `Ask with source`
- If actions are not fully backed yet, wire them to non-destructive local UI states/toasts rather than fake persistence

- [ ] **Step 5: Run targeted tests**

Run: `rtk npm run test -- --run src/src/__tests__/explore-shell.test.tsx src/src/__tests__/search-page-flow.test.tsx`

Expected: PASS.

---

### Task 5: Make Workspace Reader-To-Draft Flow Explicit

**Files:**
- Modify: `src/src/components/shell/document-workspace-shell.tsx`
- Modify: `src/src/components/pages/reader.tsx`
- Modify: `src/src/components/pages/notes.tsx`
- Modify: `src/src/__tests__/document-workspace-shell.test.tsx`
- Create or modify: `src/src/__tests__/core-workflow.test.tsx`

- [ ] **Step 1: Write failing core workflow test**

Create `core-workflow.test.tsx` with a mocked selected document and assert:

- workspace shows Reader as primary
- selected source title appears
- user can switch to Draft
- draft is seeded from selected source
- save action calls `api.addNote` and `api.commit`

- [ ] **Step 2: Run test and verify failure**

Run: `rtk npm run test -- --run src/src/__tests__/core-workflow.test.tsx`

Expected: FAIL until shell exposes the full flow.

- [ ] **Step 3: Update workspace shell**

In `document-workspace-shell.tsx`:

- Rename heading/copy to `Workspace`
- Make Reader / Draft / Notes tabs read as one workflow, not separate products
- Surface source metadata and save state clearly
- Keep current page ids compatible

- [ ] **Step 4: Add extract-to-draft affordance**

In `reader.tsx`:

- Add a clear `Save excerpt to draft` action near selection/highlight UI
- Use existing draft store actions; avoid backend write until final draft save
- Show feedback when an excerpt is added

- [ ] **Step 5: Run targeted tests**

Run: `rtk npm run test -- --run src/src/__tests__/core-workflow.test.tsx src/src/__tests__/document-workspace-shell.test.tsx`

Expected: PASS.

---

### Task 6: Consolidate Editor And Notes Semantics

**Files:**
- Modify: `src/src/components/pages/editor.tsx`
- Modify: `src/src/components/pages/notes.tsx`
- Modify: `src/src/components/ui/template-manager.tsx`
- Modify: `src/src/__tests__/document-tabs.test.tsx`
- Modify: `src/src/__tests__/document-workspace-shell.test.tsx`

- [ ] **Step 1: Add tests for one writing mental model**

Update `document-tabs.test.tsx` to assert tabs/copy do not imply three unrelated writing products. Expected labels should be:

- `Reader`
- `Draft`
- `Notes`
- optional `Output` sections for report/podcast only where currently used

- [ ] **Step 2: Run targeted tests**

Run: `rtk npm run test -- --run src/src/__tests__/document-tabs.test.tsx src/src/__tests__/document-workspace-shell.test.tsx`

Expected: FAIL if current copy is inconsistent.

- [ ] **Step 3: Align labels and save states**

- In `notes.tsx`, make save state language match Workspace draft flow.
- In `editor.tsx`, keep advanced editor powers but align side panel wording with notes/links/draft.
- In `template-manager.tsx`, keep templates as writing support, not a separate product surface.

- [ ] **Step 4: Run targeted tests**

Run: `rtk npm run test -- --run src/src/__tests__/document-tabs.test.tsx src/src/__tests__/document-workspace-shell.test.tsx`

Expected: PASS.

---

### Task 7: Add Product Architecture Documentation

**Files:**
- Create: `docs/product-architecture-3.0.md`
- Create: `docs/domain-model-3.0.md`
- Modify: `src/README.md`
- Modify: `docs/release-checklist.md`

- [ ] **Step 1: Draft product architecture doc**

Create `docs/product-architecture-3.0.md` with:

```md
# ClawKB 3.0 Product Architecture

## Surfaces
- Workbench: Ask, resume, quick actions.
- Library: browse, import, search, analysis views.
- Workspace: reader, draft, notes, evidence.
- Settings: KB, AI, import/sync, backup, labs.

## Core Loop
Open KB → Import/Search/Ask → Open source → Read/Ask selection → Save note/draft → Resume.

## Design Rule
A feature is core only if it strengthens the core loop. Otherwise it belongs in Analysis, Generated, or Labs.
```

- [ ] **Step 2: Draft domain model doc**

Create `docs/domain-model-3.0.md` with:

```md
# ClawKB 3.0 Domain Model

## Objects
- KnowledgeBase
- SourceDocument
- NoteDocument
- WorkspaceDraft
- SourceFragment
- Citation
- SavedItem
- Property
- WorkspacePreset

## Relationships
- SourceDocument can seed WorkspaceDraft.
- WorkspaceDraft can save into NoteDocument.
- NoteDocument participates in search, links, graph, tags, and timeline.
- Citation links AI answers and notes back to source fragments.
```

- [ ] **Step 3: Update README and release checklist**

In `src/README.md`:

- Mention four-surface model
- Mention 3.0 core loop
- Keep desktop runtime limitations clear

In `docs/release-checklist.md`:

- Add 3.0 checks for Workbench / Library / Workspace / Settings
- Add core loop smoke test

- [ ] **Step 4: Run docs-adjacent validation**

Run: `rtk npm run build`

Expected: PASS.

---

### Task 8: Settings IA Cleanup

**Files:**
- Modify: `src/src/components/pages/settings.tsx`
- Modify: `src/src/__tests__/settings-page.test.tsx`

- [ ] **Step 1: Add settings grouping test**

Update `settings-page.test.tsx` to assert visible groups:

- `Knowledge Base`
- `AI Models`
- `Import & Sync`
- `Backup & Recovery`
- `Labs`

- [ ] **Step 2: Run test and verify failure**

Run: `rtk npm run test -- --run src/src/__tests__/settings-page.test.tsx`

Expected: FAIL until headings are updated.

- [ ] **Step 3: Reorganize settings headings only**

In `settings.tsx`:

- Keep existing controls and command calls
- Reorder/rename sections into 3.0 groups
- Do not change WebDAV password storage behavior
- Do not change AI model command behavior

- [ ] **Step 4: Run targeted tests**

Run: `rtk npm run test -- --run src/src/__tests__/settings-page.test.tsx src/src/__tests__/ai-store.test.ts`

Expected: PASS.

---

### Task 9: Runtime Guard Copy Alignment

**Files:**
- Modify: `src/src/App.tsx`
- Modify: `src/src/api/platform.ts`
- Modify: `src/src/__tests__/runtime-guard.test.tsx`
- Modify: `docs/runtime-modes.md`

- [ ] **Step 1: Add runtime copy test**

Update `runtime-guard.test.tsx` to assert browser preview explains:

- Browser preview is visual verification only
- Real KB work requires desktop runtime
- Opening/creating/import/search/OCR/sync are desktop-only

- [ ] **Step 2: Run test**

Run: `rtk npm run test -- --run src/src/__tests__/runtime-guard.test.tsx`

Expected: PASS or fail only on copy drift.

- [ ] **Step 3: Adjust copy if needed**

Only update copy; do not add fake browser data or fallback product flows.

- [ ] **Step 4: Run targeted tests**

Run: `rtk npm run test -- --run src/src/__tests__/runtime-guard.test.tsx src/src/__tests__/commands-runtime.test.ts`

Expected: PASS.

---

### Task 10: Full Validation Pass

**Files:**
- No new files unless fixing test fixtures.

- [ ] **Step 1: Run full frontend tests**

Run: `rtk npm run test`

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run: `rtk npm run build`

Expected: PASS.

- [ ] **Step 3: Run lint**

Run: `rtk npm run lint`

Expected: PASS. If unrelated lint failures exist, document them and do not fix unrelated files.

- [ ] **Step 4: Run Rust check if frontend command bridge changed**

Run: `rtk npm run rust:check`

Expected: PASS. Skip only if no Tauri/backend commands were modified.

- [ ] **Step 5: Manual desktop smoke**

Run: `rtk npm run tauri:dev`

Verify manually:

- Desktop app opens default KB or setup guidance
- Workbench shows Ask + Continue working
- Library opens Search and Import
- Search result opens Workspace Reader
- Draft saves back to KB
- Settings sections are grouped clearly

---

## 4. Non-Goals For This Plan

Do not implement these in the first execution pass:

- Full Obsidian-compatible filesystem Vault source-of-truth
- Full plugin SDK or community plugin marketplace
- Full Obsidian Sync equivalent
- Full Publish equivalent
- Whiteboard/Canvas productionization
- Inline database/Bases productionization
- New backend storage migrations

These remain in `kb3.0.md` as later strategic work.

---

## 5. Suggested Commit Sequence

Use small commits after each task passes targeted tests:

```bash
git add src/src/domain src/src/__tests__/domain-navigation.test.ts src/src/App.tsx
git commit -m "feat: define 3.0 navigation surfaces"

git add src/src/domain/workflow.ts src/src/store/document-workspace-store.ts src/src/__tests__/store-persistence.test.ts
git commit -m "feat: persist workspace source context"

git add src/src/components/shell/workbench-shell.tsx src/src/components/home src/src/__tests__/workbench-shell.test.tsx src/src/__tests__/home-*.test.tsx
git commit -m "feat: refocus workbench around core loop"

git add src/src/components/shell/explore-shell.tsx src/src/components/pages/search.tsx src/src/__tests__/explore-shell.test.tsx src/src/__tests__/search-page-flow.test.tsx
git commit -m "feat: reframe explore as library"

git add src/src/components/shell/document-workspace-shell.tsx src/src/components/pages/reader.tsx src/src/components/pages/notes.tsx src/src/__tests__/core-workflow.test.tsx src/src/__tests__/document-workspace-shell.test.tsx
git commit -m "feat: make reader to draft workflow explicit"

git add docs/product-architecture-3.0.md docs/domain-model-3.0.md src/README.md docs/release-checklist.md plan8.md
git commit -m "docs: add ClawKB 3.0 implementation plan"
```

---

## 6. Acceptance Criteria

The 3.0 first execution pass is complete when:

- Four-surface model is encoded and tested.
- Legacy page ids still route without breaking saved state.
- Workbench makes Ask + Continue working the primary experience.
- Library groups search/import as core and analysis/generated outputs as secondary.
- Workspace clearly supports Reader → Draft/Notes → Save to KB.
- Settings groups match the 3.0 information architecture.
- Browser preview still blocks fake KB flows.
- `rtk npm run test` passes.
- `rtk npm run build` passes.
- `kb3.0.md` remains the strategic analysis, and `plan8.md` becomes the execution plan.

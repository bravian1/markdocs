# Architecture

Technical reference for how markdocs works internally. For usage, setup, and
deployment see [README.md](./README.md).

## Big picture

```
┌─────────────────────────── Browser ───────────────────────────┐
│  Workspace (apps/web)                                         │
│  ├── MarkdocsEditor  ← @markdocs/editor (TipTap/ProseMirror)   │
│  ├── Raw textarea    ← same tab state, plain markdown          │
│  └── DrawView        ← tldraw, snapshot sidecars               │
└───────────────┬───────────────────────────────────────────────┘
                │ REST (cookie-authenticated)
┌───────────────▼────────────── Next.js server ─────────────────┐
│  app/api/* route handlers — thin controllers                  │
│  ├── authorizeDoc()   → role check per level                  │
│  ├── lib/services/    → document CRUD                         │
│  ├── lib/drawings/    → tldraw sidecar store                  │
│  ├── lib/versions/    → snapshot history                      │
│  ├── lib/sharing/     → ACL index, roles, presence            │
│  └── lib/auth/        → sessions, passwords, rate limiting    │
└───────────────┬───────────────────────────────────────────────┘
                │ fs (all paths via resolveSafePath)
┌───────────────▼───────────────────────────────────────────────┐
│  MARKDOCS_ROOT                                                │
│  ├── *.md                    source of truth                  │
│  ├── *.md.draw.json          tldraw snapshots                 │
│  └── .markdocs/              users, ACLs, versions, trash     │
└───────────────────────────────────────────────────────────────┘
```

## Packages

### packages/shared

Pure types only, zero dependencies — imported by both the editor package and
the web app. Contains `TreeNode`, `DocumentContent`, `DocAcl`, and every REST
request/response shape. If you change an API payload, change it here first.

### packages/markdown-core

Server-side markdown → HTML pipeline built on unified:

- remark-gfm (tables, task lists, strikethrough)
- `remarkWikiLinks` — custom plugin for `[[wiki links]]`
- remark-math → rehype-katex for `$...$` / `$$...$$`
- Code fences are pre-highlighted with Shiki before the unified pass; unknown
  languages fall back to escaped `<pre>`
- Mermaid fences become `<pre class="mermaid-source">` placeholders that the
  browser hydrates
- `stripDangerousTags` rehype pass drops script/style/iframe from rendered
  output

Also exports frontmatter extraction, title derivation, word counting.

### packages/editor

The TipTap editor package, UI-free of any markdocs-specific server concepts.
Key pieces:

- **Schema** — TipTap StarterKit plus custom nodes: `mermaidBlock`,
  `inlineMath`/`blockMath`, `wikiLink` mark, tables, `taskItem` allowed
  directly inside bullet lists (GFM style)
- **markdown round-trip** (`markdown/parse.ts`, `serialize.ts`) — a
  ProseMirror `MarkdownParser` bound to the schema via markdown-it, with
  plugins for task lists, math, mermaid fences, wiki links, and table cells.
  The same parser powers document loading *and* markdown-aware paste
- **paste handler** (`components/markdocs-editor.tsx`) — image paste routes to
  the `uploadImage` callback; multi-line clipboard text matching markdown
  heuristics is parsed through the full pipeline instead of inserted as plain
  text
- **MermaidView** renders diagrams in a sandboxed iframe (`allow-same-origin`
  only — no scripts), auto-sizes from the SVG, re-themes on dark-class flips

Round-trip fidelity is covered by `roundtrip.test.ts`.

## apps/web

### Request lifecycle (save path)

1. Editor `onChange` → workspace stores `currentMarkdown` on the tab
2. Debounced autosave (800 ms) → `PUT /api/document {path, content}`
3. Handler: `requireUser` → `authorizeDoc(write)` → version snapshot of the
   previous content → write through `resolveSafePath`
4. Response mtime recorded client-side for live-sync comparison

### Live sync & conflicts

While a document is open the client polls `/api/document/mtime`. If the
server mtime differs from the last-known one:

- No local edits → silently pull the remote version
- Local edits present → conflict banner: "Load their version" /
  "Keep mine (overwrite)" / Dismiss

Presence heartbeats (`/api/document/presence`) run every other tick and drive
the "N other people viewing" indicator.

### Sharing model

`permissions.json` is a flat index: `{ [docPath]: { owner, collaborators,
link } }`. Role resolution order: owner > direct collaborator > link token.
Unauthenticated users only ever get link access. The tree endpoint filters
documents by resolved role, so unowned files are invisible rather than 403.

First registration claims all pre-existing files for the owner
(`claim-all-docs.ts`).

### Drawings

`tldraw` runs client-side. Snapshots use `getSnapshot(editor.store)` →
`PUT /api/document/drawing` → written as `<doc>.md.draw.json` next to the
document. Loading is the reverse via `loadSnapshot`. Renames move the sidecar;
deletes remove it. Validation requires a `document` key before writing.

Snapshots store shapes/camera/pages as JSON — no binaries, diff-friendly.

### Version history

Every save snapshots the *previous* content to
`.markdocs/versions/<docPath>/<epoch>.md`, pruned to the newest 50. Version
ids are the epoch filenames and must match `/^\d+$/` before being used in a
path.

## Testing

Vitest, node environment, aliases resolve workspace packages to source:

| Suite | Covers |
| --- | --- |
| `packages/markdown-core/src/index.test.ts` | render pipeline, frontmatter, titles, words |
| `packages/editor/src/markdown/*.test.ts` | parse/serialize round-trips, plugin behaviors |
| `apps/web/src/lib/export/export.test.ts` | self-contained HTML export |
| `apps/web/src/lib/sharing/sharing.test.ts` | ACL resolution, tree filtering |
| `apps/web/src/lib/lib.test.ts` | misc lib utilities |

Run everything with `pnpm test`.

## Conventions

- **One job per module** — file names describe the single operation; look for
  the `// One job: X.` header comment
- Controllers stay thin; logic lives in `lib/`
- All filesystem access funnels through `lib/fs/` with traversal guards
- Strict TS everywhere; `noUncheckedIndexedAccess` means indexed access needs
  a `!` or a guard

# markdocs

Google-Docs-style editing for **plain markdown files** — WYSIWYG editor,
tldraw whiteboards, mermaid diagrams, math, version history, exports, sharing.

No database. Your documents are `.md` files on disk; everything else is a
couple of JSON sidecars. Human-readable, greppable, git-friendly.

> 📐 For internal design — request lifecycle, sharing model, package
> boundaries — see [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Features

- ✍️ **Three view modes per document** — rich WYSIWYG editing (TipTap), raw
  markdown source, and a tldraw drawing canvas
- 🥷 Live mermaid diagrams (sandboxed iframe), KaTeX math, Shiki code
  highlighting, GFM tables & task lists
- 📝 Slash commands (`/`), bubble toolbar, `[[wiki links]]`,
  markdown-aware paste (paste a whole md document and it keeps its structure)
- 🎨 tldraw draw mode per document — sketches persist as `<doc>.md.draw.json`
  sidecars next to the markdown
- 💾 Autosave + **version history** with preview & restore (50 snapshots/doc)
- 📤 Export: Markdown / self-contained HTML / PDF via print
- 🔐 Accounts + Google-Docs-style sharing: invite by email (viewer/editor),
  anyone-with-the-link, public read-only `/share/[token]` views
- 👀 Live sync — remote edits detected while you read; conflict banner when
  both sides changed; presence indicator for other viewers
- 📱 Responsive — drawer sidebar and icon toolbar on small screens
- 🌗 Light/dark theme via a single centralized CSS token file

## Prerequisites

- **Node.js 20+** (22+ recommended — the Docker image uses Node 22)
- **pnpm 9+** — the repo pins it via the `packageManager` field, so if you have
  [Corepack](https://nodejs.org/api/corepack.html) (bundled with Node) just run
  `corepack enable` once and the right version is used automatically.
  Alternatively: `npm install -g pnpm`

## Quick start

```bash
corepack enable    # or: npm install -g pnpm
pnpm install
pnpm dev          # http://localhost:3000 — first visit shows the owner setup form
pnpm test         # vitest suite (50 tests)
```

The first account registered becomes the owner. Documents live in
`~/Documents/md-docs` by default (override with `MARKDOCS_ROOT`).

## Repository layout

pnpm workspace monorepo:

| Path | What it is |
| --- | --- |
| `packages/shared` | Dependency-free TypeScript types + REST contract |
| `packages/markdown-core` | Markdown pipeline (unified/remark/rehype) — no UI deps |
| `packages/editor` | TipTap editor package: schema, markdown parse/serialize, extensions (mermaid, math, wiki links) |
| `apps/web` | Next.js app: UI shell + API routes over local files |

### apps/web internals

```
apps/web/src/
├── app/                  # Pages + API route handlers
│   ├── api/              # REST endpoints (see API reference below)
│   ├── login/            # Sign-in / owner setup
│   ├── print/            # PDF export reader view
│   └── share/[token]/    # Public read-only share views
├── components/           # Workspace shell, dialogs, DrawView (tldraw)
└── lib/
    ├── api/              # Authorization + route helpers
    ├── auth/             # Password hashing, sessions, rate limiting
    ├── drawings/         # tldraw snapshot sidecar store
    ├── export/           # HTML/PDF export builders
    ├── fs/               # Safe path resolution, file IO
    ├── services/         # Document CRUD operations
    ├── sharing/          # ACL store, role resolution, presence
    └── versions/         # Snapshot history store
```

## Storage model

Everything under the docs root (`MARKDOCS_ROOT`, default `~/Documents/md-docs`):

```
my-docs/
├── notes/
│   └── ideas.md                    # a document
│   └── ideas.md.draw.json          # its tldraw drawing (created on first sketch)
├── Welcome.md
└── .markdocs/                      # app metadata — keep out of git
    ├── users.json                  # accounts (hashed passwords)
    ├── permissions.json            # ACL index keyed by doc path
    ├── versions/                   # timestamped snapshots (<path>/<epoch>.md)
    └── .markdocs-trash/            # soft-deleted docs (sibling of .markdocs)
```

- Documents are plain markdown — edit them in any editor, markdocs picks up
  changes on reload
- Sessions are stateless signed cookies (HMAC); no session store
- Deleting a doc moves it to trash and drops its ACL entry

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `MARKDOCS_ROOT` | `~/Documents/md-docs` | Docs root directory (created if missing) |
| `MARKDOCS_INSECURE_COOKIES` | unset | Set to `1` only when serving plain HTTP on a trusted network; otherwise terminate TLS so cookies stay `secure` |

## API reference

All endpoints are cookie-authenticated and return `{ error }` envelopes on
failure. Authorization levels: viewer < editor < owner.

| Method & path | Level | Purpose |
| --- | --- | --- |
| `POST /api/auth/register` | first run only | Bootstrap the owner account |
| `POST /api/auth/login` / `logout` | public | Session management |
| `GET /api/auth/status` | public | `needsSetup` flag + current user |
| `GET/POST /api/documents` | read/create | Tree listing, create file/folder |
| `GET/PUT /api/document` | read/write | Fetch/save one doc (autosave target) |
| `DELETE /api/document` | owner | Soft-delete to trash |
| `PATCH /api/document` | editor | Rename/move; ACLs + drawings follow |
| `GET /api/document/mtime` | read | Last-modified poll (live sync) |
| `GET/PUT /api/document/drawing` | read/write | tldraw snapshot sidecar |
| `GET/PUT /api/document/share` | owner | Collaborators + link sharing |
| `GET /api/document/versions` · restore | read/editor | Snapshot history |
| `POST /api/document/presence` | read | "Who's viewing" heartbeat |
| `GET /api/document/export?format=md\|html` | read | Downloads (PDF goes via `/print` + browser print) |
| `POST /api/uploads` | editor | Image upload → URL |
| `GET /api/shared/[token]` | token | Public read-only document |

## Development

```bash
pnpm dev                        # dev server on :3000
pnpm test                       # vitest once
npx vitest                      # watch mode
pnpm lint                       # eslint (warnings block in CI)
pnpm build                      # typecheck all packages
pnpm --filter @markdocs/web exec next build   # production build
```

CI (`.github/workflows/ci.yml`) runs typecheck → lint (`--max-warnings=0`) →
tests → build on every push/PR.

Conventions used throughout the codebase:

- **One job per module** — services and stores do exactly one thing; you'll
  see `// One job: X.` header comments
- **Strict TypeScript** — `noUncheckedIndexedAccess` is on
- **No database** — every mutation goes through the fs layer with
  `resolveSafePath` traversal guards

### Editing documents externally

Files on disk are the source of truth, but new files dropped into the root
need an ACL entry before they appear (ownership model). Easiest path: create
the document through the UI, or copy an existing entry in
`.markdocs/permissions.json`.

## Deployment

```bash
pnpm --filter @markdocs/web exec next build
MARKDOCS_ROOT=/path/to/docs pnpm --filter @markdocs/web exec next start -p 3000
```

Or with Docker:

```bash
docker build -t markdocs .
docker run -p 3000:3000 -v ~/md-docs:/data/docs -e MARKDOCS_ROOT=/data/docs markdocs
```

> ⚠️ Don't run `next build` while `next dev` is serving from the same
> directory — they share `.next/` and the dev server's compiled chunks will be
> clobbered (symptom: `Cannot find module './NNNN.js'`). Stop dev first, or
> wipe `.next` afterwards.

### tldraw licensing

Draw mode uses the [tldraw SDK](https://tldraw.dev), which is free in
development but requires a license key for production deployments (a free
100-day trial is available). Without a key, production builds show a watermark
and log a console notice. The drawing snapshot format is plain JSON, so the
canvas library can be swapped without touching storage.

## Security notes

- Passwords hashed with scrypt + per-user salt; sessions are HMAC-signed
  stateless cookies (`userId.expiry.signature`), `secure` unless
  `MARKDOCS_INSECURE_COOKIES=1`
- Login rate-limited: 8 attempts / minute / key (in-memory window)
- All paths go through `resolveSafePath` — traversal attempts throw;
  version ids must be numeric (no path injection via crafted ids)
- Mermaid renders inside a sandboxed iframe with no `allow-scripts`; rendered
  HTML passes a strip-dangerous pass (script/style/iframe removed)
- Uploads restricted to png/jpeg/gif/webp/svg with extension allowlist

# Status & Verification Tracker

Living document tracking what is done, what is not, and what is in flight.
Last updated: 2026-09-07

## 1. Repo / publishing

| Item | Status | Notes |
| --- | --- | --- |
| Committed locally | ✅ Done | `main`, working tree clean at last check |
| Pushed to GitHub | ✅ Done | https://github.com/bravian1/markdocs (public, under `bravian1`) |
| Security / public-content audit | ✅ Done | No `.env`, `.markdocs/`, secrets, keys, or user docs in the repo or history. All 124 tracked files scanned. Session secret is generated at runtime, never committed |
| README setup docs for strangers | ✅ Done | Added "Prerequisites" section (Node 20+, pnpm via Corepack), `corepack enable` as step one |
| Pin toolchain | ✅ Done | `packageManager: pnpm@10.30.3`, `engines.node >= 20` — commit `d03555e` |

## 2. Automated tests

| Suite | Status | Notes |
| --- | --- | --- |
| Vitest unit tests | ✅ 50/50 pass | One flaky first run (mermaid export test timing, 49/50) — passes consistently on rerun; not reproducible on fresh runs |
| `pnpm lint` (tsc --noEmit per package) | ✅ Passes | |

## 3. Browser E2E (`node cdp-e2e.mjs`, headless Chrome on :3111)

Full run against a **pristine** fixture (`/tmp/markdocs-ui`, `MARKDOCS_ROOT`):

**✅ 31/35 checks passing**, including: registration → workspace, file tree, WYSIWYG
rendering (heading/bold/tasks/table/mermaid SVG + labels/KaTeX), theme toggle,
⌘K palette open/filter/close, HTML export (self-contained + mermaid labels),
MD export, export menu, version history list + restore, image upload → served
asset, share dialog, link sharing, share-token extraction, logout, anonymous API
denied, public read-only shared view.

### ❌ 4 failing checks (all flake-class, need confirmation):

1. **`typing persists to disk (autosave)`** — FAILS only on a cold dev server
   (first save of the session must compile the `/api/document` route; test waits
   2 s). The typed text **does** reach the file afterwards (confirmed on disk).
   → Likely test timing, not an app bug. Fix candidate: wait for the save / warm
   the route before the assertion.
2. **`wiki link renders as pill`** — typing `[[CDP Wiki Test]]` into a paragraph
   after the version-restore step did not produce a `.md-wiki-link`. NOT yet
   confirmed whether this is a real gap or a test artifact (this check runs right
   after version restore on the same doc; wiki extension does define a
   `markInputRule`). A focused probe was started but interrupted — **inconclusive,
   needs a rerun.**
3. **`mermaid renders in shared view`** — failed once on a polluted second run,
   passed on the pristine run's shared-view load; likely a cold-compile timing
   flake. Needs one more clean confirmation.
4. **`no console errors`** — one 500 captured: `ReferenceError: MutationObserver
   is not defined` from **Next.js dev-mode dev-overlay/DevTools**, on the very
   first SSR `GET /` of a fresh server. Known Next dev-mode quirk; no app stack.
   Expect it to be absent in a production (`next start`) run.

## 4. In flight / next steps

- [ ] Rerun focused wiki-link probe (login → open doc → type `[[x]]` → check pill)
      to classify item 3.2 as app bug or test artifact
- [ ] If wiki pill typing is a genuine gap, fix the extension / paste handling
- [ ] Consider making e2e autosave + mermaid-shared checks compile-tolerant
      (warm-up route, longer bounded wait) so cold runs are green
- [ ] Optionally run the same E2E against a production build (`next build && next
      start`) to prove the console-error check is clean outside dev mode
- [ ] Delete stale `docs/STATUS.md`-adjacent scratch state in `/tmp` when finished
      (`markdocs-ui`, `markdocs-*-profile`, logs)

## 5. Scratch state (not part of the repo)

- Dev server run target: `http://localhost:3111` (Next dev, workspace Next 15)
- E2E docs root: `/tmp/markdocs-ui` (contains `welcome.md`, `projects/notes.md`)
- E2E log: `/tmp/markdocs-e2e.log` · dev log: `/tmp/markdocs-dev.log`
- E2E owner account (fixture only): `owner@test.dev` / `super-secret-9`
- CDP screenshot scripts: `cdp-e2e.mjs`, `cdp-shots.mjs`, `cdp-screenshot.mjs` (in repo)

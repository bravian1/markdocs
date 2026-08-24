/* eslint-disable */
/**
 * Raw CDP end-to-end test for MarkDocs.
 * Uses Node 24's built-in WebSocket. No dependencies.
 *
 * Usage: node cdp-e2e.mjs
 * Expects: app on :3111, Chrome launched with --remote-debugging-port=9222
 */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const APP = process.env.E2E_APP ?? "http://localhost:3111";
const CDP_PORT = 9226;
const CDP_HTTP = `http://127.0.0.1:${CDP_PORT}`;

const results = [];
function report(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Minimal CDP client over WebSocket. */
class Cdp {
  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = () => rej(new Error("WS error"));
    });
    return new Cdp(ws);
  }

  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.consoleErrors = [];
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id && this.pending.has(data.id)) {
        const { resolve, reject } = this.pending.get(data.id);
        this.pending.delete(data.id);
        if (data.error) reject(new Error(data.error.message));
        else resolve(data.result);
      } else if (data.method) {
        if (
          data.method === "Runtime.exceptionThrown" ||
          (data.method === "Log.entryAdded" && data.params.entry.level === "error")
        ) {
          this.consoleErrors.push(
            data.params?.exceptionDetails?.text ??
              data.params?.entry?.text ??
              "unknown"
          );
        }
      }
    };
  }

  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) =>
      this.pending.set(id, { resolve, reject })
    );
  }

  /** Evaluate an expression and return the JSON value. */
  async eval(expression, awaitPromise = false) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text ?? "eval failed");
    }
    return res.result.value;
  }

  close() {
    this.ws.close();
  }
}

async function waitFor(client, expression, timeoutMs = 10000, interval = 250) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await client.eval(expression)) return true;
    } catch {
      /* page may be navigating */
    }
    await sleep(interval);
  }
  return false;
}

// ---------------------------------------------------------------------------

async function main() {
  // Launch headless Chrome.
  const chrome = spawn(
    "/usr/bin/google-chrome",
    [
      "--headless=new",
      `--remote-debugging-port=${CDP_PORT}`,
      "--no-sandbox",
      "--disable-gpu",
      "--user-data-dir=/tmp/markdocs-cdp-profile",
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  try {
    // Wait for the debugger endpoint.
    let targets = null;
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`${CDP_HTTP}/json/list`);
        targets = await res.json();
        break;
      } catch {
        await sleep(250);
      }
    }
    if (!targets) throw new Error("Chrome debugger never came up");

    const page = targets.find((t) => t.type === "page");
    const client = await Cdp.connect(page.webSocketDebuggerUrl);

    await client.send("Runtime.enable");
    await client.send("Page.enable");
    await client.send("Log.enable");

    // --- 1. Load the app — should redirect to /login (fresh install) ------
    await client.send("Page.navigate", { url: APP });
    await sleep(1500);

    const loginForm = await waitFor(
      client,
      `document.body.innerText.includes('Create your account') || document.body.innerText.includes('Sign in')`
    );
    report("unauthenticated visit shows auth form", loginForm);

    // --- 1b. Register owner (fresh) or sign in (existing) -------------------
    async function fillInput(placeholder, text) {
      await client.eval(`document.querySelector("input[placeholder='${placeholder}']")?.focus()`);
      await client.send("Input.insertText", { text });
      await sleep(80);
    }

    const isFresh = await client.eval(
      `document.body.innerText.includes('Create your account')`
    );
    if (isFresh) {
      await fillInput("Your name", "Test Owner");
      await fillInput("you@example.com", "owner@test.dev");
      await fillInput("At least 8 characters", "super-secret-9");
      await client.eval(`
        [...document.querySelectorAll("button")].find(b => b.textContent.includes('Create account'))?.click()
      `);
    } else {
      await fillInput("you@example.com", "owner@test.dev");
      await fillInput("Password", "super-secret-9");
      await client.eval(`
        [...document.querySelectorAll("button")].find(b => b.textContent.includes('Sign in'))?.click()
      `);
    }

    const wsUp = await waitFor(
      client,
      `!!document.querySelector('aside')`,
      15000
    );
    report(isFresh ? "registration lands in workspace" : "login lands in workspace", wsUp);
    await sleep(800);

    // --- 2. Sidebar file tree renders -------------------------------------
    const treeOk = await waitFor(
      client,
      `document.body.innerText.includes('welcome')`
    );
    report("file tree shows welcome.md", treeOk);
    const folderOk = await client.eval(
      `document.body.innerText.includes('projects')`
    );
    report("file tree shows projects folder", folderOk);

    // --- 3. Open the document ---------------------------------------------
    await client.eval(`
      [...document.querySelectorAll("button")]
        .find(b => b.textContent.trim() === "welcome")
        ?.click()
    `);
    const editorUp = await waitFor(
      client,
      `!!document.querySelector(".md-editor-content")`
    );
    report("opens doc in editor", editorUp);

    // --- 4. WYSIWYG rendering ---------------------------------------------
    await sleep(800); // allow initial setContent to settle

    const h1 = await client.eval(
      `[...document.querySelectorAll('.md-editor-content h1')]
         .some(h => h.textContent.includes('Hello MarkDocs'))`
    );
    report("heading rendered", !!h1);

    const bold = await client.eval(
      `!!document.querySelector('.md-editor-content strong')`
    );
    report("bold rendered as <strong>", bold);

    const tasks = await client.eval(
      `document.querySelectorAll('.md-editor-content li[data-checked]').length`
    );
    report("task list items rendered", tasks === 2, `count=${tasks}`);

    const tableCells = await client.eval(
      `document.querySelectorAll('.md-editor-content th').length`
    );
    report("table headers rendered", tableCells === 2, `count=${tableCells}`);

    // Mermaid renders in a sandboxed iframe — check it exists and that
    // node labels survived rendering.
    const mermaidOk = await waitFor(
      client,
      `(() => {
        const f = document.querySelector('.md-mermaid-preview iframe');
        try {
          return f && f.contentDocument?.querySelector('svg') !== null;
        } catch { return false; }
      })()`,
      20000
    );
    report("mermaid diagram renders as SVG", mermaidOk);

    const mermaidLabels = await waitFor(
      client,
      `(() => {
        try {
          const doc = document.querySelector('.md-mermaid-preview iframe')?.contentDocument;
          return !!doc && doc.body.textContent.includes('Docs');
        } catch { return false; }
      })()`,
      10000
    );
    report("mermaid node labels preserved", mermaidLabels);

    const katex = await client.eval(
      `document.querySelectorAll('.md-editor-content .katex').length`
    );
    report("KaTeX math rendered", katex >= 2, `count=${katex}`);

    // --- 5. Typing triggers autosave to disk ------------------------------
    const before = readFileSync("/tmp/markdocs-ui/welcome.md", "utf8");
    await client.eval(`
      (() => {
        const el = document.querySelector('.md-editor-content');
        el.focus();
        const p = el.querySelector('p');
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(p);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      })()
    `);
    await client.send("Input.insertText", { text: " Typed via CDP." });
    await sleep(2000); // wait out the 800ms debounce + save

    const after = readFileSync("/tmp/markdocs-ui/welcome.md", "utf8");
    report(
      "typing persists to disk (autosave)",
      after.includes("Typed via CDP.") && after !== before
    );

    // --- 6. Theme toggle ----------------------------------------------------
    const darkBefore = await client.eval(
      `document.documentElement.classList.contains('dark')`
    );
    await client.eval(`
      document.querySelector("button[title='Toggle theme']")?.click()
    `);
    await sleep(300);
    const darkAfter = await client.eval(
      `document.documentElement.classList.contains('dark')`
    );
    report(
      "theme toggles dark class",
      darkBefore !== darkAfter,
      `${darkBefore} → ${darkAfter}`
    );
    // Toggle back.
    await client.eval(`
      document.querySelector("button[title='Toggle theme']")?.click()
    `);

    // --- 7. Command palette (⌘K) --------------------------------------------
    await client.eval(`
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'k', ctrlKey: true, bubbles: true
      }));
    `);
    const paletteOpen = await waitFor(
      client,
      `!!document.querySelector('[role=dialog] input')`
    );
    report("⌘K opens command palette", paletteOpen);

    const searchFilter = await client.eval(`
      (() => {
        const input = document.querySelector('[role=dialog] input');
        if (!input) return false;
        input.value = 'notes';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()
    `);
    await sleep(200);
    const paletteResults = await client.eval(`
      [...document.querySelectorAll('[role=dialog] button')]
        .some(b => b.textContent.includes('notes'))
    `);
    report("palette lists matching documents", searchFilter && paletteResults);

    // Close palette with a TRUSTED key event (synthetic ones don't reach Radix).
    await client.send("Input.dispatchKeyEvent", {
      type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27,
    });
    await client.send("Input.dispatchKeyEvent", {
      type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27,
    });
    const paletteClosed = await waitFor(
      client,
      `!document.querySelector('[role=dialog]')`
    );
    report("palette closes on Escape", paletteClosed);

    // --- 9. Export endpoints -------------------------------------------------
    const exportHtml = await client.eval(`
      fetch('/api/document/export?path=welcome.md&format=html').then(r => r.text())
    `, true);
    report(
      "html export: self-contained with fonts",
      typeof exportHtml === "string" &&
        exportHtml.includes("data:font/woff2;base64") &&
        exportHtml.includes("mermaid-svg"),
      `${String(exportHtml).length} bytes`
    );

    const exportLabels = await client.eval(`
      fetch('/api/document/export?path=welcome.md&format=html')
        .then(r => r.text())
        .then(t => t.includes('Docs'))
    `, true);
    report("html export: mermaid labels preserved", !!exportLabels);

    const exportMd = await client.eval(`
      fetch('/api/document/export?path=welcome.md&format=md').then(r => r.text())
    `, true);
    report(
      "md export: raw markdown stream",
      typeof exportMd === "string" && exportMd.includes("# Hello MarkDocs")
    );

    // Export menu renders in the tab bar.
    // NOTE: Radix menus need real pointer events, not synthetic .click().
    const box = await client.eval(`
      (() => {
        const b = [...document.querySelectorAll("button")].find(b => b.title === 'Export');
        if (!b) return null;
        b.scrollIntoView({ block: 'center' });
        const r = b.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      })()
    `);
    let menuVisible = false;
    if (box && typeof box.x === "number") {
      await client.send("Input.dispatchMouseEvent", {
        type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1,
      });
      await client.send("Input.dispatchMouseEvent", {
        type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1,
      });
      menuVisible = await waitFor(
        client,
        `[...document.querySelectorAll('[role=menuitem]')]
          .some(m => m.textContent?.includes('Markdown'))`
      );
    }
    report("export menu opens with options", menuVisible);

    // Close menu.
    await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape" });
    await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape" });


    // --- 9b. Version history, wiki links, image uploads ----------------------
    // Snapshots exist because the typing test above triggered autosaves.
    const versions = await client.eval(
      `fetch('/api/document/versions?path=welcome.md').then(r => r.json()).catch(() => null)`,
      true
    );
    report(
      "version history lists snapshots",
      Array.isArray(versions) && versions.length > 0,
      `${Array.isArray(versions) ? versions.length : 0} versions`
    );

    if (Array.isArray(versions) && versions.length > 0) {
      const restoreStatus = await client.eval(
        `fetch('/api/document/versions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: 'welcome.md', version: '${versions[0].id}' }),
        }).then((r) => r.status)`,
        true
      );
      report("version restore works", restoreStatus === 200);
    }

    // Wiki link: type [[...]] and expect the pill mark to render.
    const wikiOk = await waitFor(client, `!!document.querySelector('.md-editor-content p')`);
    if (!wikiOk) throw new Error("editor lost");
    await client.eval(`
      (() => {
        const el = document.querySelector('.md-editor-content');
        el.focus();
        const p = [...el.querySelectorAll(':scope > p')].pop();
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(p);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      })()
    `);
    await client.send("Input.insertText", { text: " See [[CDP Wiki Test]]" });
    const wikiPill = await waitFor(
      client,
      `[...document.querySelectorAll('.md-wiki-link')]
        .some(w => w.getAttribute('data-target') === 'CDP Wiki Test')`,
      6000
    );
    report("wiki link renders as pill", wikiPill);

    // Image upload round-trip.
    const upload = await client.eval(`
      (async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 2; canvas.height = 2;
        const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
        const fd = new FormData();
        fd.append('file', blob, 'dot.png');
        const res = await fetch('/api/uploads', { method: 'POST', body: fd });
        return { status: res.status, ...(await res.json()) };
      })()
    `, true);
    report(
      "image upload returns asset URL",
      !!upload && upload.status === 201 && String(upload.url || "").startsWith("/api/assets/"),
      JSON.stringify(upload)
    );

    if (upload?.url) {
      const assetType = await client.eval(
        `fetch('${upload.url}').then(r => r.headers.get('content-type'))`,
        true
      );
      report("uploaded asset serves as image", assetType === "image/png", `type=${assetType}`);
    }


    // --- 10. Sharing flow ----------------------------------------------------
    // Open the Share dialog via real mouse events.
    const shareBtn = await client.eval(`
      (() => {
        const b = [...document.querySelectorAll("button")].find(b => b.title === 'Share document');
        if (!b) return null;
        b.scrollIntoView({ block: 'center' });
        const r = b.getBoundingClientRect();
        return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      })()
    `);
    const sb = JSON.parse(shareBtn);
    await client.send("Input.dispatchMouseEvent", { type: "mousePressed", x: sb.x, y: sb.y, button: "left", clickCount: 1 });
    await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: sb.x, y: sb.y, button: "left", clickCount: 1 });

    const dialogUp = await waitFor(
      client,
      `[...document.querySelectorAll('[role=dialog]')].some(d => d.textContent?.includes('Anyone with the link'))`
    );
    report("share dialog opens", dialogUp);

    // Enable anyone-with-link (viewer).
    await client.eval(`
      [...document.querySelectorAll('[role=dialog] button')]
        .find(b => b.textContent.trim() === 'Can viewer')?.click()
    `);
    const linkShown = await waitFor(
      client,
      `(() => {
        const d = [...document.querySelectorAll('[role=dialog]')][0];
        return !!d && d.innerHTML.includes('/share/');
      })()`
    );
    report("link sharing produces a share URL", linkShown);

    // Extract the token.
    const token = await client.eval(`
      (() => {
        const m = document.querySelector('[role=dialog]')?.innerHTML.match(/\\/share\\/([A-Za-z0-9_-]+)/);
        return m ? m[1] : null;
      })()
    `);
    report("share token extractable", !!token, `token=${String(token).slice(0, 8)}…`);

    // Close dialog via trusted Escape.
    await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await sleep(300);

    // Sign out via real click.
    const outBtn = await client.eval(`
      (() => {
        const b = [...document.querySelectorAll("button")].find(b => b.title === 'Sign out');
        if (!b) return null;
        b.scrollIntoView({ block: 'center' });
        const r = b.getBoundingClientRect();
        return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      })()
    `);
    const ob = JSON.parse(outBtn);
    await client.send("Input.dispatchMouseEvent", { type: "mousePressed", x: ob.x, y: ob.y, button: "left", clickCount: 1 });
    await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: ob.x, y: ob.y, button: "left", clickCount: 1 });

    const backToLogin = await waitFor(
      client,
      `location.pathname === '/login' || document.body.innerText.includes('Sign in')`
    );
    report("logout returns to sign-in", backToLogin);

    // API now denies anonymous access.
    const anonStatus = await client.eval(
      `fetch('/api/document?path=welcome.md').then(r => r.status).catch(() => 0)`,
      true
    );
    report("anonymous API access denied", anonStatus === 401 || anonStatus === 403, `status=${anonStatus}`);

    // Public share view works and is read-only.
    await client.send("Page.navigate", { url: `${APP}/share/${token}` });
    const sharedEditor = await waitFor(
      client,
      `!!document.querySelector('.md-editor-content')`,
      15000
    );
    report("shared link opens read-only view", sharedEditor);

    const readOnly = await client.eval(
      `!!document.querySelector('.md-editor-content.ProseMirror-readonly') ||
       document.querySelector('.md-editor-content')?.getAttribute('contenteditable') === 'false'`
    );
    report("shared view is read-only", !!readOnly);

    const sharedMermaid = await waitFor(
      client,
      `(() => {
        try {
          return !!document.querySelector('.md-mermaid-preview iframe')?.contentDocument?.querySelector('svg');
        } catch { return false; }
      })()`,
      15000
    );
    report("mermaid renders in shared view", sharedMermaid);

    // --- 10. Console cleanliness ---------------------------------------------
    const realErrors = client.consoleErrors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("Download the React DevTools") &&
        !e.includes("third-party cookie") &&
        // Expected 401s: deliberate anonymous-access probes in this suite.
        !(e.includes("401") || e.includes("Unauthorized"))
    );
    report(
      "no console errors",
      realErrors.length === 0,
      realErrors.slice(0, 3).join(" | ")
    );

    client.close();
  } finally {
    chrome.kill("SIGKILL");
    // Ensure no headless chrome survives (crashpad helpers etc.).
    try {
      const { execSync } = await import("node:child_process");
      execSync(
        `pkill -9 -f 'markdocs-cdp-profile' 2>/dev/null || true`
      );
    } catch {
      /* best effort */
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("E2E DRIVER ERROR:", err.message);
  process.exit(1);
});

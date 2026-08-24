/* eslint-disable */
// Capture light & dark screenshots of the workspace with an open document.
import { spawn } from "node:child_process";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("WS")); });
    const c = new Cdp(ws); return c;
  }
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map();
    ws.onmessage = (m) => { const d = JSON.parse(m.data);
      if (d.id && this.pending.has(d.id)) { const p = this.pending.get(d.id); this.pending.delete(d.id); p(d.result ?? d.error); } };
  }
  send(method, params = {}) { const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res) => this.pending.set(id, res)); }
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", { expression, returnByValue: true });
    return r.result?.value; }
  async shot(path) {
    const r = await this.send("Page.captureScreenshot", { format: "png" });
    const { writeFileSync } = await import("node:fs");
    writeFileSync(path, Buffer.from(r.data, "base64"));
    console.log("saved", path);
  }
}

const chrome = spawn("/usr/bin/google-chrome",
  ["--headless=new", "--remote-debugging-port=9227", "--no-sandbox",
   "--user-data-dir=/tmp/markdocs-shot-profile", "--window-size=1440,900", "about:blank"],
  { stdio: "ignore" });

await sleep(2500);
let page;
for (let i = 0; i < 20; i++) {
  try { const t = await (await fetch("http://127.0.0.1:9227/json/list")).json();
    page = t.find(x => x.type === "page"); if (page) break; } catch {}
  await sleep(300);
}
const c = await Cdp.connect(page.webSocketDebuggerUrl);
await c.send("Page.enable");
await c.send("Page.navigate", { url: "http://localhost:3111" });
await sleep(2000);
await c.eval(`[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "welcome")?.click()`);
await sleep(4500); // let mermaid lazy-load
await c.shot("/tmp/markdocs-light.png");
await c.eval(`document.querySelector("button[title='Toggle theme']")?.click()`);
await sleep(1200);
await c.shot("/tmp/markdocs-dark.png");
c.ws.close();
chrome.kill("SIGKILL");
process.exit(0);

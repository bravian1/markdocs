/* eslint-disable */
// Screenshots of the share dialog + public shared view.
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
      if (d.id && this.pending.has(d.id)) { const p = this.pending.get(d.id); this.pending.delete(d.id);
        p(d.error ? (() => { throw new Error(d.error.message); })() : d.result); } }; }
  send(method, params = {}) { const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res) => this.pending.set(id, res)); }
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return r.result?.value; }
  async shot(path) {
    const r = await this.send("Page.captureScreenshot", { format: "png" });
    const { writeFileSync } = await import("node:fs");
    writeFileSync(path, Buffer.from(r.data, "base64"));
    console.log("saved", path); }
}
async function mouseClick(c, x, y) {
  await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}

const chrome = spawn("/usr/bin/google-chrome",
  ["--headless=new", "--remote-debugging-port=9230", "--no-sandbox",
   "--user-data-dir=/tmp/markdocs-share-profile", "--window-size=1440,900", "about:blank"],
  { stdio: "ignore" });
await sleep(2500);
let page;
for (let i = 0; i < 20; i++) {
  try { const t = await (await fetch("http://127.0.0.1:9230/json/list")).json();
    page = t.find(x => x.type === "page"); if (page) break; } catch {}
  await sleep(300);
}
const c = await Cdp.connect(page.webSocketDebuggerUrl);
await c.send("Page.enable");

// Login first.
await c.send("Page.navigate", { url: "http://localhost:3111/login" });
await sleep(2000);
for (const [ph, text] of [["you@example.com", "owner@test.dev"], ["Password", "super-secret-9"]]) {
  await c.eval(`document.querySelector("input[placeholder='${ph}']")?.focus()`);
  await c.send("Input.insertText", { text });
}
await c.eval(`[...document.querySelectorAll("button")].find(b => b.textContent.includes('Sign in'))?.click()`);
await sleep(2500);

// Open welcome doc + share dialog.
await c.eval(`[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "welcome")?.click()`);
await sleep(1500);
const box = JSON.parse(await c.eval(`(() => {
  const b = [...document.querySelectorAll("button")].find(b => b.title === 'Share document');
  b.scrollIntoView({block:'center'});
  const r = b.getBoundingClientRect();
  return JSON.stringify({x:r.left+r.width/2,y:r.top+r.height/2});
})()`));
await mouseClick(c, box.x, box.y);
await sleep(1000);
// Enable link sharing so the URL row shows.
await c.eval(`[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === 'Can viewer')?.click()`);
await sleep(600);
await c.shot("/tmp/share-dialog.png");

// Grab the token, then shoot the public view.
const token = await c.eval(
  `document.querySelector('[role=dialog]')?.innerHTML.match(/\\/share\\/([A-Za-z0-9_-]+)/)?.[1]`
);
console.log("TOKEN:", token);
await c.send("Page.navigate", { url: `http://localhost:3111/share/${token}` });
await sleep(5000);
await c.shot("/tmp/shared-view.png");
c.ws.close();
chrome.kill("SIGKILL");
process.exit(0);

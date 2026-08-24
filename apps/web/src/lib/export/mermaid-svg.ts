/**
 * Server-side mermaid rendering for exports.
 *
 * Mermaid v11 can render in Node when a DOM is present. We boot one jsdom,
 * polyfill the handful of browser APIs it lacks (CSSStyleSheet constructor,
 * approximate SVG text metrics), and render diagrams to standalone SVGs.
 *
 * Globals are configured once per process; subsequent calls reuse them.
 */

let domPromise: Promise<unknown> | null = null;

/** Prepare global DOM so mermaid can run on the server. One job: env setup. */
async function ensureDomEnvironment(): Promise<void> {
  const g = globalThis as Record<string, unknown>;
  if (g.__markdocsMermaidDomReady) return;

  if (!domPromise) {
    domPromise = (async () => {
      const { JSDOM } = await import("jsdom");
      const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
        pretendToBeVisual: true,
      });

      g.document = dom.window.document;
      g.window = dom.window;
      Object.defineProperty(g, "navigator", {
        value: dom.window.navigator,
        configurable: true,
      });

      // CSSStyleSheet constructor — used by mermaid's style injection.
      const w = dom.window as unknown as { CSSStyleSheet?: unknown };
      g.CSSStyleSheet =
        w.CSSStyleSheet ??
        class FakeStyleSheet {
          cssRules: unknown[] = [];
          insertRule(rule: string) {
            this.cssRules.push(rule);
            return 0;
          }
          deleteRule() {}
          addRule() {}
          removeRule() {}
        };

      // Approximate text metrics — enough for dagre layout to size nodes.
      // Values are clamped so accumulating measurement containers can't
      // explode the layout.
      const proto = dom.window.SVGElement.prototype as unknown as Record<
        string,
        unknown
      >;
      proto.getBBox = function getBBox(this: { textContent?: string }) {
        const t = String(this.textContent ?? "").trim();
        const width = Math.min(220, t.length * 8 + 24);
        const lines = Math.max(1, (t.match(/\n/g)?.length ?? 0) + 1);
        const height = Math.min(120, lines * 22 + 6);
        return { x: 0, y: 0, width, height };
      };
      proto.getCTM = function getCTM() {
        return {
          a: 1, b: 0, c: 0, d: 1, e: 0, f: 0,
          inverse() { return this; },
          multiply() { return this; },
        };
      };

      const purify = (await import("dompurify")).default;
      const DP = purify(dom.window as unknown as Parameters<typeof purify>[0]);
      g.DOMPurify = DP;
      (dom.window as Record<string, unknown>).DOMPurify = DP;
    })();
  }

  await domPromise;
  g.__markdocsMermaidDomReady = true;
}

let renderSeq = 0;

/**
 * Render one mermaid diagram source to an SVG string.
 * Returns null on failure — callers fall back to showing source.
 */
export async function renderMermaidToSvg(
  source: string,
  theme: "default" | "dark" = "default"
): Promise<string | null> {
  try {
    await ensureDomEnvironment();
    const mermaid = (await import("mermaid")).default;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme,
    });
    const id = `mmd-export-${++renderSeq}`;
    const { svg } = await mermaid.render(id, source);

    // Detect degenerate layouts: without real font metrics, dagre can
    // collapse everything into a sliver. Prefer a clean source block.
    const match = /viewBox="[^"]*\s(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)"/.exec(svg);
    if (!match) return null;
    const w = Number(match[1]);
    const h = Number(match[2]);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 60 || h < 40) {
      return null;
    }
    return svg;
  } catch (err) {
    console.error("[export] mermaid render failed:", err);
    return null;
  }
}

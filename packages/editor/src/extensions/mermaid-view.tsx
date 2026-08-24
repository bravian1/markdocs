"use client";

import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";

type ViewMode = "diagram" | "source";

/**
 * Client-side renderer for mermaid blocks.
 *
 * The editable source is ProseMirror content (NodeViewContent); the diagram
 * preview re-renders whenever that content changes.
 *
 * Security model:
 * - mermaid runs with securityLevel:"strict" (label text sanitized internally)
 * - the rendered SVG is placed inside a sandboxed iframe with NO allow-scripts,
 *   so nothing in the diagram markup can ever execute
 */
export function MermaidView({ node }: NodeViewProps) {
  const source = node.textContent;
  const hasSource = source.trim().length > 0;

  const [mode, setMode] = useState<ViewMode>(hasSource ? "diagram" : "source");
  const [svg, setSvg] = useState<string | null>(null);
  const [frameHeight, setFrameHeight] = useState(320);
  const [error, setError] = useState<string | null>(null);
  const [themeTick, setThemeTick] = useState(0);
  const renderId = useRef(`mmd-${Math.random().toString(36).slice(2, 10)}`);
  const renderSeq = useRef(0);

  // Re-render diagrams when the app theme flips (dark class on <html>).
  useEffect(() => {
    const observer = new MutationObserver(() => setThemeTick((t) => t + 1));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (mode !== "diagram" || !hasSource) return;
    const seq = ++renderSeq.current;
    let cancelled = false;

    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: document.documentElement.classList.contains("dark")
            ? "dark"
            : "default",
        });
        const { svg: rendered } = await mermaid.render(
          `${renderId.current}-${seq}`,
          source
        );
        if (cancelled) return;
        setSvg(rendered);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setSvg(null);
          setError(err instanceof Error ? err.message : "Diagram error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source, mode, hasSource, renderId, themeTick]);

  const srcDoc = svg
    ? `<!DOCTYPE html><html><head><style>` +
      `html,body{margin:0;padding:0;background:transparent;overflow:hidden}` +
      `svg{max-width:100%;height:auto;display:block}` +
      `</style></head><body>${svg}</body></html>`
    : "";

  return (
    <NodeViewWrapper className="md-mermaid-wrapper">
      <div className="md-mermaid-toolbar" contentEditable={false}>
        <button
          type="button"
          className="md-chip-button"
          onClick={() => setMode(mode === "diagram" ? "source" : "diagram")}
        >
          {mode === "diagram" ? (
            <>
              <MermaidIcon /> Mermaid · Edit
            </>
          ) : (
            <>
              <MermaidIcon /> Mermaid · Preview
            </>
          )}
        </button>
      </div>

      {/* Diagram preview — hidden while editing source. */}
      {mode === "diagram" && (
        <div className="md-mermaid-preview" contentEditable={false}>
          {error ? (
            <div className="md-mermaid-error">
              <span>⚠ {error}</span>
              <button type="button" onClick={() => setMode("source")}>
                Fix source
              </button>
            </div>
          ) : srcDoc ? (
            <iframe
              className="md-mermaid-frame"
              style={{ height: frameHeight }}
              sandbox="allow-same-origin"
              srcDoc={srcDoc}
              title="Mermaid diagram preview"
              onLoad={(e) => {
                try {
                  const el =
                    e.currentTarget.contentDocument?.querySelector("svg");
                  if (el) {
                    const h = Math.ceil(el.getBoundingClientRect().height);
                    if (h > 40) setFrameHeight(h + 8);
                  }
                } catch {
                  /* sizing is best-effort */
                }
              }}
            />
          ) : (
            <div className="md-mermaid-loading">Rendering diagram…</div>
          )}
        </div>
      )}

      {/* Editable source — always mounted so PM state stays consistent. */}
      <NodeViewContent
        as="pre"
        className={`md-mermaid-source${mode === "diagram" ? " md-collapsed" : ""}`}
      >
        <code />
      </NodeViewContent>
    </NodeViewWrapper>
  );
}

function MermaidIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <path d="M10 6.5h4v11h-4" />
    </svg>
  );
}

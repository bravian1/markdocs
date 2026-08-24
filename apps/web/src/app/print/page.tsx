"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { renderMarkdown } from "@markdocs/markdown-core";
import { EXPORT_CSS } from "@/lib/export/export-css";

/**
 * Print-friendly reader view — the PDF export path.
 *
 * Renders entirely client-side so mermaid diagrams get real browser layout
 * (pixel-perfect), then opens the print dialog automatically.
 */

function PrintReader() {
  const searchParams = useSearchParams();
  const docPath = searchParams.get("path") ?? "";
  const [html, setTitle] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const printed = useRef(false);

  // Load + render the document.
  useEffect(() => {
    if (!docPath) {
      setFailed(true);
      return;
    }
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(
          `/api/document?path=${encodeURIComponent(docPath)}`
        );
        if (!res.ok) throw new Error("not found");
        const doc = (await res.json()) as { title: string; content: string };
        const rendered = await renderMarkdown(doc.content);
        if (!cancelled) {
          document.title = doc.title;
          setTitle(rendered);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [docPath]);

  // Hydrate mermaid placeholders with real browser-rendered SVGs.
  useEffect(() => {
    if (html === null) return;
    let cancelled = false;

    void (async () => {
      const container = document.querySelector(".document");
      if (!container) return;
      const placeholders = container.querySelectorAll("pre.mermaid-source");
      if (placeholders.length === 0) {
        triggerPrint();
        return;
      }

      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: document.documentElement.classList.contains("dark")
          ? "dark"
          : "default",
      });

      let seq = 0;
      for (const pre of Array.from(placeholders)) {
        if (cancelled) return;
        const source = pre.textContent ?? "";
        try {
          const { svg } = await mermaid.render(`print-mmd-${++seq}`, source);
          const div = document.createElement("div");
          div.className = "mermaid-svg";
          div.innerHTML = svg; /* mermaid strict mode sanitized */
          pre.replaceWith(div);
        } catch {
          pre.classList.add("mermaid-fallback");
        }
      }
      if (!cancelled) triggerPrint();
    })();

    return () => {
      cancelled = true;
    };
  }, [html]);

  /** Open the print dialog exactly once. One job: printing. */
  function triggerPrint() {
    if (printed.current) return;
    printed.current = true;
    // Small delay lets fonts/images settle.
    setTimeout(() => window.print(), 300);
  }

  if (failed) {
    return (
      <p style={{ fontFamily: "sans-serif", padding: "2rem" }}>
        Document not found.
      </p>
    );
  }

  return (
    <>
      <style>{`
        body { margin: 0; background: #fff; color: #1a1a1a; }
        @media print { .no-print { display: none; } }
      `}</style>
      <style>{EXPORT_CSS}</style>
      {html === null ? (
        <p style={{ fontFamily: "sans-serif", padding: "2rem" }}>Loading…</p>
      ) : (
        <article className="document" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={<p style={{ padding: "2rem" }}>Loading…</p>}>
      <PrintReader />
    </Suspense>
  );
}

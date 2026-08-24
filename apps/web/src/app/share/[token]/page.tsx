"use client";

import { Link2 } from "lucide-react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Editor is DOM-bound — client-only render.
const MarkdocsEditor = dynamic(
  () => import("@markdocs/editor").then((m) => ({ default: m.MarkdocsEditor })),
  { ssr: false }
);

/**
 * Public share view. Read-only rendering of a shared document;
 * viewers see the full rich content but can never edit.
 */
export default function SharedDocPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [state, setState] = useState<
    { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; title: string; markdown: string }
  >({ phase: "loading" });

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/shared/${encodeURIComponent(token)}`);
        if (!res.ok) throw new Error("This link is invalid or no longer shared.");
        const body = (await res.json()) as { title: string; content: string };
        setState({ phase: "ready", title: body.title, markdown: body.content });
        document.title = `${body.title} · Shared`;
      } catch (err) {
        setState({
          phase: "error",
          message:
            err instanceof Error ? err.message : "Could not load this document.",
        });
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex h-12 items-center gap-2 border-b border-[var(--border)] px-4">
        <Link2 className="h-4 w-4 opacity-60" />
        <span className="text-sm font-semibold tracking-tight">MarkDocs</span>
        <span className="text-xs text-[var(--muted-foreground)]">· shared read-only</span>
      </header>

      {state.phase === "loading" && (
        <p className="p-8 text-center text-sm opacity-50">Loading…</p>
      )}
      {state.phase === "error" && (
        <div className="mx-auto mt-24 max-w-md rounded-xl border border-[var(--border)] p-8 text-center">
          <p className="font-medium">{state.message}</p>
        </div>
      )}
      {state.phase === "ready" && (
        <MarkdocsEditor initialMarkdown={state.markdown} editable={false} />
      )}
    </div>
  );
}

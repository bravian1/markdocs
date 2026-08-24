"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Tldraw,
  getSnapshot,
  loadSnapshot,
  type Editor,
  type TLEditorSnapshot,
} from "tldraw";
import "tldraw/tldraw.css";

const AUTOSAVE_MS = 1200;

interface DrawViewProps {
  /** Doc path the drawing belongs to. */
  docPath: string;
  /** Bump to force a reload from disk after external changes. */
  reloadNonce?: number;
}

/**
 * tldraw canvas bound to a document. Snapshots persist server-side via
 * /api/document/drawing as a `<doc>.draw.json` sidecar. One job: drawing.
 */
export function DrawView({ docPath, reloadNonce = 0 }: DrawViewProps) {
  const editorRef = useRef<Editor | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [dirty, setDirty] = useState(false);

  // Load the saved snapshot when the doc (or nonce) changes.
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setDirty(false);
    editorRef.current = null;

    void (async () => {
      try {
        const res = await fetch(
          `/api/document/drawing?path=${encodeURIComponent(docPath)}`
        );
        if (!res.ok) throw new Error("Failed to load drawing");
        const body = (await res.json()) as {
          snapshot: TLEditorSnapshot | null;
        };
        if (cancelled) return;
        pendingSnapshot.current = body.snapshot;
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [docPath, reloadNonce]);

  // Snapshot fetched before the editor mounts lands here.
  const pendingSnapshot = useRef<TLEditorSnapshot | null>(null);

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
    const snapshot = pendingSnapshot.current;
    pendingSnapshot.current = null;
    if (snapshot) {
      try {
        void loadSnapshot(editor.store, snapshot);
      } catch (err) {
        console.error("drawing load failed", err);
      }
    }

    // Debounced autosave on any change.
    editor.store.listen(
      () => {
        setDirty(true);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          void (async () => {
            const current = editorRef.current;
            if (!current) return;
            try {
              const snap = getSnapshot(current.store);
              await fetch("/api/document/drawing", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: docPath, snapshot: snap }),
              });
              setDirty(false);
            } catch {
              /* keep dirty; next change retries */
            }
          })();
        }, AUTOSAVE_MS);
      },
      { scope: "document" }
    );
  }, [docPath]);

  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center text-sm opacity-50">
        Loading drawing…
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--destructive)]">
        Failed to load drawing.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Tldraw key={`${docPath}:${reloadNonce}`} onMount={handleMount} />
      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-[var(--secondary)] px-2 py-0.5 text-xs opacity-70">
        {dirty ? "Saving drawing…" : "Drawing saved"}
      </div>
    </div>
  );
}

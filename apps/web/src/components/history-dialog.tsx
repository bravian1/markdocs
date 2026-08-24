"use client";

import { History, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { VersionInfo } from "@/lib/versions/version-store";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface HistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docPath: string;
  /** Called after a successful restore so the editor reloads. */
  onRestored: () => void;
}

/**
 * Version history: list snapshots, preview one, restore it.
 */
export function HistoryDialog({ open, onOpenChange, docPath, onRestored }: HistoryDialogProps) {
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [selected, setSelected] = useState<VersionInfo | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setPreview(null);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(
          `/api/document/versions?path=${encodeURIComponent(docPath)}`
        );
        if (!res.ok) throw new Error("Failed to load history");
        setVersions((await res.json()) as VersionInfo[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Load failed");
      }
    })();
  }, [open, docPath]);

  async function selectVersion(v: VersionInfo) {
    setSelected(v);
    setPreview(null);
    try {
      const res = await fetch(
        `/api/document/versions?path=${encodeURIComponent(docPath)}&version=${v.id}`
      );
      if (!res.ok) throw new Error();
      setPreview(await res.text());
    } catch {
      setError("Could not load version");
    }
  }

  async function restore() {
    if (!selected) return;
    setRestoring(true);
    try {
      const res = await fetch("/api/document/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: docPath, version: selected.id }),
      });
      if (!res.ok) throw new Error("Restore failed");
      onOpenChange(false);
      onRestored();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
      setRestoring(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Version history
          </DialogTitle>
        </DialogHeader>

        {error && <p className="text-sm text-[var(--destructive)]">⚠ {error}</p>}

        {versions.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
            No versions yet — a snapshot is taken every time you save.
          </p>
        ) : (
          <div className="grid grid-cols-[15rem_1fr] gap-4">
            {/* List */}
            <ul className="max-h-80 overflow-y-auto rounded-lg border border-[var(--border)]">
              {versions.map((v) => (
                <li key={v.id}>
                  <button
                    onClick={() => void selectVersion(v)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-[var(--accent)] ${
                      selected?.id === v.id
                        ? "bg-[var(--secondary)] font-medium"
                        : ""
                    }`}
                  >
                    <div>
                      {new Date(v.savedAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {(v.sizeBytes / 1024).toFixed(1)} KB
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            {/* Preview */}
            <div className="flex min-h-64 flex-col rounded-lg border border-[var(--border)]">
              {preview === null ? (
                <p className="m-auto text-sm text-[var(--muted-foreground)]">
                  Select a version to preview
                </p>
              ) : (
                <>
                  <pre className="max-h-56 flex-1 overflow-auto rounded-t-lg bg-[var(--code-bg,#f5f5f5)] p-3 text-xs leading-relaxed">
                    {preview}
                  </pre>
                  <Button
                    size="sm"
                    className="m-3"
                    onClick={() => void restore()}
                    disabled={restoring}
                  >
                    <RotateCcw /> {restoring ? "Restoring…" : "Restore this version"}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

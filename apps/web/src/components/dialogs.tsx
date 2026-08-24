"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface PromptRequest {
  title: string;
  message?: string;
  /** When set, shows a text input pre-filled with this value. */
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

/**
 * Themed replacement for window.prompt/window.confirm/window.alert.
 * Returns the entered string (prompt), true/false (confirm),
 * or null when dismissed.
 */
export function useDialogs() {
  const [request, setRequest] = useState<PromptRequest | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const resolverRef = useRef<((v: string | null) => void) | null>(null);

  function ask(req: PromptRequest): Promise<string | null> {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setValue(req.initial ?? "");
      setError(null);
      setRequest(req);
    });
  }

  function settle(result: string | null) {
    setRequest(null);
    resolverRef.current?.(result);
    resolverRef.current = null;
  }

  const element: ReactNode = request ? (
    <Dialog open onOpenChange={(open) => !open && settle(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{request.title}</DialogTitle>
        </DialogHeader>

        {request.message && (
          <p className="text-sm text-[var(--muted-foreground)]">{request.message}</p>
        )}

        {request.initial !== undefined || request.placeholder ? (
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={request.placeholder}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                settle(value.trim() || null);
              }
            }}
          />
        ) : null}

        {error && <p className="text-sm text-[var(--destructive)]">⚠ {error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={() => settle(null)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant={request.destructive ? "destructive" : "default"}
            onClick={() => {
              // Prompt mode requires non-empty input when confirmed empty.
              const needsValue = request.initial !== undefined || request.placeholder;
              if (needsValue && !value.trim()) {
                setError("Please enter a value");
                return;
              }
              settle(needsValue ? value.trim() : "ok");
            }}
          >
            {request.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  ) : null;

  return { ask, element };
}

export interface Toast {
  id: number;
  message: string;
  kind: "error" | "success" | "info";
}

/** Minimal toast list + viewport. One job: show transient messages. */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  function toast(message: string, kind: Toast["kind"] = "info") {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }

  const element: ReactNode = (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${
            t.kind === "error"
              ? "border-[var(--destructive)] bg-[var(--destructive)]/10 text-[var(--destructive)]"
              : "border-[var(--border)] bg-[var(--popover)] text-[var(--popover-foreground)]"
          }`}
        >
          {t.kind === "error" ? "⚠ " : t.kind === "success" ? "✓ " : ""}
          {t.message}
        </div>
      ))}
    </div>
  );

  return { toast, element };
}

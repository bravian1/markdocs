"use client";

import { FileText, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { TreeNode } from "@markdocs/shared";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { prettyName } from "@/components/file-tree";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tree: TreeNode[];
  onOpenFile: (path: string) => void;
}

/** Flatten a tree to searchable file entries. One job: flatten. */
function flattenFiles(nodes: TreeNode[], out: TreeNode[] = []): TreeNode[] {
  for (const node of nodes) {
    if (node.type === "file") out.push(node);
    if (node.children) flattenFiles(node.children, out);
  }
  return out;
}

/** ⌘K quick-open palette. */
export function CommandPalette({ open, onOpenChange, tree, onOpenFile }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const files = useMemo(() => flattenFiles(tree), [tree]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files.slice(0, 12);
    return files
      .filter((f) => f.path.toLowerCase().includes(q))
      .slice(0, 12);
  }, [files, query]);

  // Reset query when opened.
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[20%] max-w-xl translate-y-0 p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Quick open</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4">
          <Search className="h-4 w-4 shrink-0 opacity-50" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
            className="h-12 border-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {results.map((file) => (
            <li key={file.path}>
              <button
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
                onClick={() => {
                  onOpenFile(file.path);
                  onOpenChange(false);
                }}
              >
                <FileText className="h-4 w-4 shrink-0 opacity-60" />
                <span>{prettyName(file.name)}</span>
                <span className="ml-auto truncate pl-3 text-xs opacity-50">
                  {file.path}
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm opacity-60">No matches</li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import { useState } from "react";
import type { TreeNode } from "@markdocs/shared";

import { cn } from "@/lib/utils";

interface FileTreeProps {
  nodes: TreeNode[];
  activePath: string | null;
  onOpenFile: (path: string) => void;
  depth?: number;
}

/** Recursive tree view of the docs folder. One job: render the hierarchy. */
export function FileTree({ nodes, activePath, onOpenFile, depth = 0 }: FileTreeProps) {
  return (
    <ul className="select-none">
      {nodes.map((node) =>
        node.type === "dir" ? (
          <FileTreeDirNode
            key={node.path}
            node={{ ...node, type: "dir" }}
            activePath={activePath}
            onOpenFile={onOpenFile}
            depth={depth}
          />
        ) : (
          <li key={node.path}>
            <button
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                "hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]",
                activePath === node.path &&
                  "bg-[var(--secondary)] font-medium text-[var(--secondary-foreground)]"
              )}
              style={{ paddingLeft: `${depth * 0.9 + 0.5}rem` }}
              onClick={() => onOpenFile(node.path)}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span className="truncate">{prettyName(node.name)}</span>
            </button>
          </li>
        )
      )}
      {nodes.length === 0 && (
        <li className="px-2 py-1.5 text-xs text-[var(--muted-foreground)]" style={{ paddingLeft: `${depth * 0.9 + 0.5}rem` }}>
          Empty folder
        </li>
      )}
    </ul>
  );
}

interface DirNode extends TreeNode {
  type: "dir";
  children?: TreeNode[];
}

function FileTreeDirNode({
  node,
  activePath,
  onOpenFile,
  depth,
}: {
  node: DirNode;
  activePath: string | null;
  onOpenFile: (path: string) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(true);
  const Icon = open ? FolderOpen : Folder;

  return (
    <li>
      <button
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
        style={{ paddingLeft: `${depth * 0.9 + 0.35}rem` }}
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronRight
          className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-90")}
        />
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
        <span className="truncate">{node.name}</span>
      </button>
      {open && (
        <FileTree
          nodes={node.children ?? []}
          activePath={activePath}
          onOpenFile={onOpenFile}
          depth={depth + 1}
        />
      )}
    </li>
  );
}

/** Strip .md extension for display. */
export function prettyName(fileName: string): string {
  return fileName.replace(/\.md$/i, "");
}

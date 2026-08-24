"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Download, FileCode2, FileText, Printer } from "lucide-react";

interface ExportMenuProps {
  /** Active document path; null disables the menu. */
  docPath: string | null;
  /** Icon-only trigger (mobile). */
  compact?: boolean;
}

/**
 * Export actions for the active document.
 * Downloads hit GET endpoints directly (browser handles saving);
 * PDF opens the print reader view.
 */
export function ExportMenu({ docPath, compact = false }: ExportMenuProps) {
  if (!docPath) return null;

  const q = `path=${encodeURIComponent(docPath)}`;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium hover:bg-[var(--accent)] disabled:opacity-50 md:px-3"
          title="Export"
        >
          <Download className="h-4 w-4" />
          {!compact && "Export"}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-48 rounded-lg border border-[var(--border)] bg-[var(--popover)] p-1 text-[var(--popover-foreground)] shadow-lg"
        >
          <DropdownMenu.Item asChild>
            <a
              href={`/api/document/export?${q}&format=md`}
              download
              className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none hover:bg-[var(--accent)]"
            >
              <FileText className="h-4 w-4 opacity-70" /> Markdown (.md)
            </a>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <a
              href={`/api/document/export?${q}&format=html`}
              download
              className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none hover:bg-[var(--accent)]"
            >
              <FileCode2 className="h-4 w-4 opacity-70" /> HTML (self-contained)
            </a>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />
          <DropdownMenu.Item asChild>
            <a
              href={`/print?${q}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none hover:bg-[var(--accent)]"
            >
              <Printer className="h-4 w-4 opacity-70" /> PDF (print)…
            </a>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

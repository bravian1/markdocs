"use client";

import { FilePlus2, FolderPlus, History, LogOut, PencilLine, Search, Share2, Trash2, FileCode2, PenTool, FileText } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TreeNode } from "@markdocs/shared";
import type { PublicUser } from "@markdocs/shared";

import { CommandPalette } from "@/components/command-palette";
import { useDialogs, useToasts } from "@/components/dialogs";
import { ExportMenu } from "@/components/export-menu";
import { FileTree, prettyName } from "@/components/file-tree";
import { ShareDialog } from "@/components/share-dialog";
import { HistoryDialog } from "@/components/history-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  createDocument,
  deleteDocument,
  fetchDocument,
  fetchTree,
  renameDocument as callRenameDocument,
  saveDocument,
} from "@/lib/api-client";
import { fetchAuthStatus, logout } from "@/lib/auth-client";

/** Flatten tree to file nodes. One job: flatten (local copy for lookup). */
function allFiles(nodes: TreeNode[], out: TreeNode[] = []): TreeNode[] {
  for (const n of nodes) {
    if (n.type === "file") out.push(n);
    if (n.children) allFiles(n.children, out);
  }
  return out;
}

// Editor is DOM-bound — client-only render.
const MarkdocsEditor = dynamic(
  () => import("@markdocs/editor").then((m) => ({ default: m.MarkdocsEditor })),
  { ssr: false }
);
const DrawView = dynamic(
  () => import("@/components/draw-view").then((m) => ({ default: m.DrawView })),
  { ssr: false }
);

const AUTOSAVE_MS = 800;

interface OpenDoc {
  path: string;
  /** Markdown currently in the editor. */
  currentMarkdown: string;
  /** Markdown known to be persisted. */
  savedMarkdown: string;
}

/** One job: manage the docs tree. */
function useTree() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const refresh = useCallback(async () => {
    try {
      setTree(await fetchTree());
    } catch (err) {
      console.error("Failed to load documents", err);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { tree, refresh };
}

export function Workspace() {
  const router = useRouter();
  const { ask, element: dialogElement } = useDialogs();
  const { toast, element: toastElement } = useToasts();
  const { tree, refresh } = useTree();
  const [tabs, setTabs] = useState<OpenDoc[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictPath, setConflictPath] = useState<string | null>(null);
  const [othersViewing, setOthersViewing] = useState(0);
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // Ref mirror of tabs so timers/persist always see fresh state.
  const tabsRef = useRef<OpenDoc[]>(tabs);
  tabsRef.current = tabs;
  // Last-known remote mtimes per path (for live sync).
  const mtimeRef = useRef(new Map<string, string>());

  /** Record a known-good mtime after we ourselves fetched/saved. */
  const noteMtime = useCallback((path: string, iso: string) => {
    mtimeRef.current.set(path, iso);
  }, []);

  // Auth gate: unauthenticated visitors go to /login.
  useEffect(() => {
    void (async () => {
      try {
        const status = await fetchAuthStatus();
        if (!status.user) {
          router.replace("/login");
          return;
        }
        setUser(status.user);
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  const activeTab = tabs.find((t) => t.path === activePath) ?? null;

  // Live sync: poll active doc for remote changes + send presence heartbeat.
  useEffect(() => {
    if (!user || !activePath) return;
    let cancelled = false;
    let tick = 0;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/document/mtime?path=${encodeURIComponent(activePath)}`
        );
        if (!res.ok) return;
        const { updatedAt } = (await res.json()) as { updatedAt: string };
        const known = mtimeRef.current.get(activePath);
        if (known && updatedAt !== known) {
          const tab = tabsRef.current.find((t) => t.path === activePath);
          if (!tab) return;
          if (tab.currentMarkdown === tab.savedMarkdown) {
            // No local edits — silently pull the remote version.
            const doc = await fetchDocument(activePath);
            noteMtime(activePath, updatedAt);
            if (cancelled) return;
            setTabs((prev) =>
              prev.map((t) =>
                t.path === activePath
                  ? { path: t.path, currentMarkdown: doc.content, savedMarkdown: doc.content }
                  : t
              )
            );
            setReloadNonce((n) => n + 1);
            setConflictPath(null);
          } else {
            setConflictPath(activePath); // unsaved local edits vs remote change
          }
        }
      } catch {
        /* offline tick */
      }

      // Presence heartbeat every other tick.
      tick += 1;
      if (tick % 2 === 0) {
        try {
          await fetch("/api/document/presence", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: activePath }),
          });
          const pres = await fetch(
            `/api/document/presence?path=${encodeURIComponent(activePath)}`
          );
          if (pres.ok) {
            const body = (await pres.json()) as { others: unknown[] };
            if (!cancelled) setOthersViewing(body.others.length);
          }
        } catch {
          /* ignore */
        }
      }
    };

    const id = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user, activePath, noteMtime]);

  /** Discard local edits and take the remote version. One job: yield. */
  const takeRemoteVersion = useCallback(async () => {
    if (!conflictPath) return;
    const doc = await fetchDocument(conflictPath);
    noteMtime(conflictPath, doc.updatedAt);
    setTabs((prev) =>
      prev.map((t) =>
        t.path === conflictPath
          ? { path: t.path, currentMarkdown: doc.content, savedMarkdown: doc.content }
          : t
      )
    );
    setConflictPath(null);
    setReloadNonce((n) => n + 1);
  }, [conflictPath]);

  /** Overwrite the remote version with our local edits. One job: force-write. */
  const keepLocalVersion = useCallback(async () => {
    if (!conflictPath) return;
    const tab = tabsRef.current.find((t) => t.path === conflictPath);
    if (!tab) return;
    await saveDocument({ path: conflictPath, content: tab.currentMarkdown });
    const r = await fetch(`/api/document/mtime?path=${encodeURIComponent(conflictPath)}`);
    if (r.ok) noteMtime(conflictPath, ((await r.json()) as { updatedAt: string }).updatedAt);
    setConflictPath(null);
  }, [conflictPath]);

  // ⌘K opens the palette.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /** Open a file in a tab (or focus its existing tab). */
  const openFile = useCallback(
    async (path: string) => {
      setActivePath(path);
      if (tabsRef.current.some((t) => t.path === path)) return;
      try {
        const doc = await fetchDocument(path);
        noteMtime(path, doc.updatedAt);
        setTabs((prev) =>
          prev.some((t) => t.path === path)
            ? prev
            : [
                ...prev,
                {
                  path,
                  currentMarkdown: doc.content,
                  savedMarkdown: doc.content,
                },
              ]
        );
      } catch (err) {
        console.error(err);
      }
    },
    []
  );

  /** Persist a tab's current content. One job: save. */
  const persist = useCallback(
    async (path: string) => {
      const tab = tabsRef.current.find((t) => t.path === path);
      if (!tab || tab.currentMarkdown === tab.savedMarkdown) return;
      try {
        await saveDocument({ path, content: tab.currentMarkdown });
        void fetch(`/api/document/mtime?path=${encodeURIComponent(path)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((b: { updatedAt?: string } | null) => {
            if (b?.updatedAt) noteMtime(path, b.updatedAt);
          });
        setTabs((prev) =>
          prev.map((t) =>
            t.path === path ? { ...t, savedMarkdown: t.currentMarkdown } : t
          )
        );
        setSaveError(null);
        void refresh(); // titles may change
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Save failed");
      }
    },
    [refresh]
  );

  /** Debounced autosave for a tab. One job: scheduling. */
  const scheduleSave = useCallback((path: string) => {
    const timers = saveTimers.current;
    const existing = timers.get(path);
    if (existing) clearTimeout(existing);
    timers.set(path, setTimeout(() => void persist(path), AUTOSAVE_MS));
  }, [persist]);

  /** Update editor content for the active tab and schedule an autosave. */
  const handleEditorChange = useCallback(
    (markdown: string) => {
      if (!activePath) return;
      setTabs((prev) =>
        prev.map((t) =>
          t.path === activePath ? { ...t, currentMarkdown: markdown } : t
        )
      );
      scheduleSave(activePath);
    },
    [activePath, scheduleSave]
  );

  /** Close a tab, flushing pending saves first. */
  const closeTab = useCallback(
    async (path: string) => {
      const timer = saveTimers.current.get(path);
      if (timer) clearTimeout(timer);
      await persist(path);
      setTabs((prev) => {
        const next = prev.filter((t) => t.path !== path);
        setActivePath((cur) =>
          cur === path ? (next[next.length - 1]?.path ?? null) : cur
        );
        return next;
      });
    },
    [persist]
  );

  /** Open a [[wiki link]] target: existing doc by name, else create it. */
  const handleWikiOpen = useCallback(
    (target: string) => {
      const wanted = target.trim().toLowerCase();
      if (!wanted) return;
      const hit = allFiles(tree).find((f) => {
        const base = prettyName(f.name).toLowerCase();
        const p = f.path.toLowerCase();
        return base === wanted || p === wanted || p === `${wanted}.md`;
      });
      if (hit) {
        void openFile(hit.path);
        return;
      }
      // No match — create a stub doc named after the target.
      void (async () => {
        try {
          const { path } = await createDocument({ parentPath: "", name: target, kind: "file" });
          await refresh();
          await openFile(path);
        } catch {
          /* ignore */
        }
      })();
    },
    [tree, openFile, refresh]
  );

  /** Create a new document and open it. */
  const handleCreateDoc = useCallback(async () => {
    const name = await ask({
      title: "New document",
      placeholder: "Document name",
      confirmLabel: "Create",
    });
    if (!name) return;
    try {
      const { path } = await createDocument({ parentPath: "", name, kind: "file" });
      await refresh();
      await openFile(path);
      toast(`Created “${name}”`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Create failed", "error");
    }
  }, [openFile, refresh]);

  /** Create a new folder. */
  const handleCreateFolder = useCallback(async () => {
    const name = await ask({
      title: "New folder",
      placeholder: "Folder name",
      confirmLabel: "Create",
    });
    if (!name) return;
    try {
      await createDocument({ parentPath: "", name, kind: "dir" });
      await refresh();
      toast(`Created folder “${name}”`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Create failed", "error");
    }
  }, [refresh]);

  /** Rename the active document via prompt. */
  const handleRenameActive = useCallback(async () => {
    if (!activePath) return;
    const currentName = activePath.split("/").pop() ?? activePath;
    const nextName = await ask({
      title: "Rename document",
      initial: currentName,
      confirmLabel: "Rename",
    });
    if (!nextName || nextName === currentName) return;
    try {
      const newPath = activePath.replace(/[^/]+$/, nextName.trim());
      await callRenameDocument(activePath, newPath);
      // Re-point the open tab.
      setTabs((prev) =>
        prev.map((t) => (t.path === activePath ? { ...t, path: newPath } : t))
      );
      setActivePath(newPath);
      await refresh();
      toast("Renamed", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Rename failed", "error");
    }
  }, [activePath, refresh]);

  /** Soft-delete the active document. */
  const handleDeleteActive = useCallback(async () => {
    if (!activePath) return;
    const ok = await ask({
      title: `Move “${prettyName(activePath)}” to trash?`,
      message: "You can find it in .markdocs-trash on disk.",
      confirmLabel: "Move to trash",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteDocument(activePath);
      await closeTab(activePath);
      await refresh();
      toast("Moved to trash", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  }, [activePath, closeTab, refresh]);

  const isDirty =
    !!activeTab && activeTab.currentMarkdown !== activeTab.savedMarkdown;

  // Raw markdown view — a plain textarea over the same tab state.
  const [rawMode, setRawMode] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  // Mobile: sidebar slides over the content; hidden by default on small screens.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleRaw = useCallback(() => {
    setRawMode((v) => !v);
    setDrawMode(false);
  }, []);
  const toggleDraw = useCallback(() => {
    setDrawMode((v) => !v);
    setRawMode(false);
  }, []);
  // Leave raw mode when switching documents so the new doc opens rendered.
  useEffect(() => {
    setRawMode(false);
    setDrawMode(false);
    setSidebarOpen(false); // close the mobile drawer after picking a doc
  }, [activePath]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] text-[var(--sidebar-foreground)] transition-transform duration-200 md:static md:translate-x-0`}
      >
        <div className="flex items-center justify-between px-3 py-3">
          <span className="text-sm font-semibold tracking-tight">MarkDocs</span>
          <button
            className="rounded p-1 opacity-60 hover:opacity-100 md:hidden"
            title="Close menu"
            onClick={() => setSidebarOpen(false)}
          >
            ×
          </button>
          <ThemeToggle />
        </div>
        <div className="flex gap-1 px-3 pb-2">
          <Button variant="outline" size="sm" onClick={() => void handleCreateDoc()}>
            <FilePlus2 /> Doc
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleCreateFolder()}>
            <FolderPlus /> Folder
          </Button>
        </div>
        <div className="px-3 pb-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => setPaletteOpen(true)}
          >
            <Search /> Search
            <span className="ml-auto text-xs opacity-50">⌘K</span>
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          <FileTree
            nodes={tree}
            activePath={activePath}
            onOpenFile={(p) => void openFile(p)}
          />
        </nav>

        {/* Signed-in user */}
        {user && (
          <div className="flex items-center gap-2 border-t border-[var(--border)] px-3 py-2.5">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-semibold text-[var(--primary-foreground)]"
              title={user.email}
            >
              {user.name.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{user.name}</div>
              <div className="truncate text-[10px] text-[var(--muted-foreground)]">
                {user.email}
              </div>
            </div>
            <Button variant="ghost" size="icon" title="Sign out" onClick={() => void handleLogout()}>
              <LogOut />
            </Button>
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Tab strip */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--border)] px-2 py-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 md:hidden"
            title="Open menu"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="text-lg leading-none">☰</span>
          </Button>
          {tabs.map((tab) => (
            <div
              key={tab.path}
              className={`group flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
                tab.path === activePath
                  ? "bg-[var(--secondary)] font-medium"
                  : "hover:bg-[var(--accent)]"
              }`}
            >
              <button
                className="max-w-48 truncate"
                onClick={() => setActivePath(tab.path)}
              >
                {prettyName(tab.path.split("/").pop() ?? tab.path)}
                {tab.currentMarkdown !== tab.savedMarkdown && (
                  <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--primary)] opacity-70 align-middle" />
                )}
              </button>
              <button
                className="opacity-40 transition-opacity hover:opacity-100"
                title="Close"
                onClick={() => void closeTab(tab.path)}
              >
                ×
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            title="Version history"
            disabled={!activePath}
            onClick={() => setHistoryOpen(true)}
          >
            <History />
            <span className="hidden md:inline">History</span>
          </Button>
          <ExportMenu docPath={activePath} compact />
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 px-2.5 md:px-3"
            title="Toggle raw markdown source view"
            disabled={!activePath}
            onClick={toggleRaw}
          >
            {rawMode ? (
              <>
                <PencilLine className="h-4 w-4 md:hidden" />
                <span className="hidden md:inline">Rich</span>
              </>
            ) : (
              <>
                <FileCode2 className="h-4 w-4 md:hidden" />
                <span className="hidden md:inline">Raw</span>
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 px-2.5 md:px-3"
            title="Toggle drawing canvas (tldraw)"
            disabled={!activePath}
            onClick={toggleDraw}
          >
            {drawMode ? (
              <>
                <FileText className="h-4 w-4 md:hidden" />
                <span className="hidden md:inline">Document</span>
              </>
            ) : (
              <>
                <PenTool className="h-4 w-4 md:hidden" />
                <span className="hidden md:inline">Draw</span>
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 px-2.5 md:px-3"
            title="Share document"
            disabled={!activePath}
            onClick={() => setShareOpen(true)}
          >
            <Share2 />
            <span className="hidden md:inline">Share</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            title="Rename document"
            disabled={!activePath}
            onClick={() => void handleRenameActive()}
          >
            <PencilLine />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="ml-1 shrink-0"
            title="Delete document"
            disabled={!activePath}
            onClick={() => void handleDeleteActive()}
          >
            <Trash2 />
          </Button>
        </div>

        {/* Conflict banner */}
        {conflictPath !== null && conflictPath === activePath && (
          <div className="flex items-center gap-3 border-b border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-4 py-2 text-sm">
            <span className="text-[var(--destructive)]">
              This document was changed by someone else while you were editing.
            </span>
            <Button size="sm" variant="outline" onClick={() => void takeRemoteVersion()}>
              Load their version
            </Button>
            <Button size="sm" variant="outline" onClick={() => void keepLocalVersion()}>
              Keep mine (overwrite)
            </Button>
            <button
              className="ml-auto opacity-50 hover:opacity-100"
              onClick={() => setConflictPath(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Save status */}
        <div className="flex h-8 items-center gap-3 border-b border-[var(--border)] px-4 text-xs text-[var(--muted-foreground)]">
          {saveError ? (
            <span className="text-[var(--destructive)]">⚠ {saveError}</span>
          ) : conflictPath !== null && conflictPath === activePath ? (
            <span className="text-[var(--destructive)]">⚠ Sync conflict</span>
          ) : isDirty ? (
            <span>Saving…</span>
          ) : activeTab ? (
            <span>All changes saved</span>
          ) : (
            <span>Select or create a document</span>
          )}
          {othersViewing > 0 && (
            <span className="ml-auto">
              👀 {othersViewing} other {othersViewing === 1 ? "person" : "people"} viewing
            </span>
          )}
        </div>

        {/* Editor */}
        <div className="min-h-0 flex-1">
          {activeTab && drawMode ? (
            <DrawView docPath={activeTab.path} reloadNonce={reloadNonce} />
          ) : activeTab && rawMode ? (
            <textarea
              key={`${activeTab.path}:raw:${reloadNonce}`}
              className="h-full w-full resize-none bg-[var(--background)] p-6 font-mono text-sm leading-relaxed outline-none"
              spellCheck={false}
              defaultValue={activeTab.currentMarkdown}
              onChange={(e) => {
                const value = e.target.value;
                setTabs((prev) =>
                  prev.map((t) =>
                    t.path === activeTab.path
                      ? { ...t, currentMarkdown: value }
                      : t
                  )
                );
                scheduleSave(activeTab.path);
              }}
            />
          ) : activeTab ? (
            <MarkdocsEditor
              key={`${activeTab.path}:${reloadNonce}`}
              initialMarkdown={activeTab.savedMarkdown}
              onChange={handleEditorChange}
              onWikiLinkOpen={handleWikiOpen}
              uploadImage={async (file) => {
                const form = new FormData();
                form.append("file", file);
                const res = await fetch("/api/uploads", { method: "POST", body: form });
                if (!res.ok) throw new Error("Upload failed");
                const body = (await res.json()) as { url: string };
                return body.url;
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm opacity-50">
              Open a document from the sidebar to start writing
            </div>
          )}
        </div>
      </main>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        tree={tree}
        onOpenFile={(p) => void openFile(p)}
      />

      {activePath && (
        <HistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          docPath={activePath}
          onRestored={() => {
            // Reload the restored content into the active tab.
            void (async () => {
              const doc = await fetchDocument(activePath);
              setTabs((prev) =>
                prev.map((t) =>
                  t.path === activePath
                    ? { path: t.path, currentMarkdown: doc.content, savedMarkdown: doc.content }
                    : t
                )
              );
              setReloadNonce((n) => n + 1); // force editor remount with fresh content
            })();
          }}
        />
      )}

      {dialogElement}
      {toastElement}

      {activePath && (
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          docPath={activePath}
        />
      )}
    </div>
  );
}

"use client";

import { Copy, Globe2, Link2, UserPlus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { DocAcl, ShareRole } from "@markdocs/shared";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docPath: string;
}

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; acl: DocAcl };

/** Fetch the current ACL. One job: load. */
async function loadAcl(docPath: string): Promise<DocAcl> {
  const res = await fetch(
    `/api/document/share?path=${encodeURIComponent(docPath)}`
  );
  if (!res.ok) throw new Error("Failed to load sharing settings");
  const body = (await res.json()) as { acl: DocAcl };
  return body.acl;
}

/** Persist collaborators + link role. One job: save. */
async function saveAcl(
  docPath: string,
  collaborators: DocAcl["collaborators"],
  linkRole: ShareRole | null
): Promise<DocAcl> {
  const res = await fetch("/api/document/share", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: docPath, collaborators, linkRole }),
  });
  if (!res.ok) throw new Error("Failed to save sharing settings");
  const body = (await res.json()) as { acl: DocAcl };
  return body.acl;
}

/**
 * Google-Docs-style share dialog:
 * collaborator list with roles, invite by email, anyone-with-link toggle.
 */
export function ShareDialog({ open, onOpenChange, docPath }: ShareDialogProps) {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [acl, setAcl] = useState<DocAcl | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ShareRole>("viewer");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setState({ phase: "loading" });
    setCopied(false);
    void loadAcl(docPath)
      .then((loaded) => {
        setAcl(loaded);
        setState({ phase: "ready", acl: loaded });
      })
      .catch((err: Error) => setState({ phase: "error", message: err.message }));
  }, [open, docPath]);

  /** Apply an ACL change and persist it. One job: commit. */
  async function commit(next: DocAcl) {
    setAcl(next);
    try {
      const saved = await saveAcl(docPath, next.collaborators, next.link?.role ?? null);
      setAcl(saved); // server returns canonical ACL (token preserved)
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  function addCollaborator() {
    if (!acl || !inviteEmail.trim()) return;
    const email = inviteEmail.trim().toLowerCase();
    if (acl.collaborators.some((c) => c.subject === email)) return;
    void commit({
      ...acl,
      collaborators: [...acl.collaborators, { subject: email, role: inviteRole }],
    });
    setInviteEmail("");
  }

  function updateCollaborator(subject: string, role: ShareRole) {
    if (!acl) return;
    void commit({
      ...acl,
      collaborators: acl.collaborators.map((c) =>
        c.subject === subject ? { ...c, role } : c
      ),
    });
  }

  function removeCollaborator(subject: string) {
    if (!acl) return;
    void commit({
      ...acl,
      collaborators: acl.collaborators.filter((c) => c.subject !== subject),
    });
  }

  function setLinkRole(role: ShareRole | null) {
    if (!acl) return;
    void commit({
      ...acl,
      link: role ? { ...(acl.link ?? { token: "" }), role } : null,
    });
  }

  const shareUrl =
    acl?.link?.token && typeof window !== "undefined"
      ? `${window.location.origin}/share/${acl.link.token}`
      : "";

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share document</DialogTitle>
        </DialogHeader>

        {state.phase === "loading" && (
          <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">Loading…</p>
        )}
        {state.phase === "error" && (
          <p className="py-6 text-center text-sm text-[var(--destructive)]">{state.message}</p>
        )}

        {state.phase === "ready" && acl && (
          <div className="space-y-5">
            {/* Invite by email */}
            <div>
              <div className="flex gap-2">
                <Input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Add by email…"
                  type="email"
                />
                <Button size="sm" onClick={addCollaborator} disabled={!inviteEmail.trim()}>
                  <UserPlus /> Invite
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-2 pl-1 text-xs text-[var(--muted-foreground)]">
                invited as
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as ShareRole)}
                  className="rounded border border-[var(--input)] bg-transparent px-1 py-0.5 text-xs"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
              </div>
            </div>

            {/* Collaborator list */}
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {acl.collaborators.length === 0 && (
                <li className="rounded-md px-2 py-3 text-sm text-[var(--muted-foreground)]">
                  Not shared with anyone yet.
                </li>
              )}
              {acl.collaborators.map((c) => (
                <li
                  key={c.subject}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--accent)]"
                >
                  <div className="min-w-0 flex-1 truncate text-sm">{c.subject}</div>
                  <select
                    value={c.role}
                    onChange={(e) => updateCollaborator(c.subject, e.target.value as ShareRole)}
                    className="rounded border border-[var(--input)] bg-transparent px-1 py-0.5 text-xs"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                  <button
                    title="Remove"
                    onClick={() => removeCollaborator(c.subject)}
                    className="opacity-50 transition-opacity hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>

            {/* Anyone-with-the-link */}
            <div className="border-t border-[var(--border)] pt-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Globe2 className="h-4 w-4 opacity-70" /> Anyone with the link
              </div>
              <div className="mb-3 flex gap-2 text-sm">
                {(["off", "viewer", "editor"] as const).map((opt) => {
                  const active = opt === "off" ? !acl.link : acl.link?.role === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setLinkRole(opt === "off" ? null : (opt as ShareRole))}
                      className={`flex-1 rounded-md border px-2 py-1.5 capitalize ${
                        active
                          ? "border-[var(--primary)] bg-[var(--secondary)] font-medium"
                          : "border-[var(--input)] hover:bg-[var(--accent)]"
                      }`}
                    >
                      {opt === "off" ? "Off" : `Can ${opt}`}
                    </button>
                  );
                })}
              </div>

              {acl.link && shareUrl && (
                <div className="flex items-center gap-2">
                  <div className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-[var(--input)] px-2 text-xs text-[var(--muted-foreground)]">
                    <Link2 className="h-3 w-3 shrink-0" />
                    <span className="truncate">{shareUrl}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void copyLink()}>
                    <Copy /> {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-[var(--destructive)]">⚠ {error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


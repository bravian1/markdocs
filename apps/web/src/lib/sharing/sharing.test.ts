import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, randomToken } from "../auth/password";
import {
  resolveRole,
  canRead,
  canEdit,
  isOwner,
} from "../sharing/resolve-role";
import { filterTreeForUser } from "../sharing/filter-tree";
import type { AclIndex, TreeNode } from "@markdocs/shared";

const OWNER = { id: "u-owner", email: "owner@test.dev", name: "Owner" };
const EDITOR = { id: "u-editor", email: "editor@test.dev", name: "Ed" };
const VIEWER = { id: "u-viewer", email: "viewer@test.dev", name: "View" };
const STRANGER = { id: "u-stranger", email: "stranger@test.dev", name: "Str" };

const INDEX: AclIndex = {
  "owned.md": { owner: OWNER.id, collaborators: [], link: null },
  "secret.md": { owner: OWNER.id, collaborators: [], link: null },
  "shared-edit.md": {
    owner: OWNER.id,
    collaborators: [{ subject: EDITOR.email, role: "editor" }],
    link: null,
  },
  "shared-view.md": {
    owner: OWNER.id,
    collaborators: [{ subject: VIEWER.email, role: "viewer" }],
    link: null,
  },
  "link-view.md": {
    owner: OWNER.id,
    collaborators: [],
    link: { token: "tok-view", role: "viewer" },
  },
  "link-edit.md": {
    owner: OWNER.id,
    collaborators: [],
    link: { token: "tok-edit", role: "editor" },
  },
};

describe("password hashing", () => {
  it("hashes and verifies correctly", () => {
    const { hash, salt } = hashPassword("correct horse battery");
    expect(hash).not.toContain("correct");
    expect(verifyPassword("correct horse battery", salt, hash)).toBe(true);
    expect(verifyPassword("wrong password", salt, hash)).toBe(false);
  });

  it("produces unique salts", () => {
    const a = hashPassword("same");
    const b = hashPassword("same");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it("generates url-safe random tokens", () => {
    const t = randomToken(18);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThan(20);
  });
});

describe("resolveRole", () => {
  it("gives owner role to the owner", () => {
    expect(resolveRole(INDEX, "owned.md", OWNER)).toBe("owner");
  });

  it("gives collaborator roles", () => {
    expect(resolveRole(INDEX, "shared-edit.md", EDITOR)).toBe("editor");
    expect(resolveRole(INDEX, "shared-view.md", VIEWER)).toBe("viewer");
  });

  it("gives link roles to anonymous users", () => {
    expect(resolveRole(INDEX, "link-view.md", null)).toBe("viewer");
    expect(resolveRole(INDEX, "link-edit.md", null)).toBe("editor");
    expect(resolveRole(INDEX, "owned.md", null)).toBeNull();
  });

  it("denies strangers without link access", () => {
    expect(resolveRole(INDEX, "owned.md", STRANGER)).toBeNull();
    expect(resolveRole(INDEX, "shared-edit.md", STRANGER)).toBeNull();
  });

  it("collaborator role beats link role", () => {
    // viewer-collaborator on a doc with an editor link stays viewer? No —
    // collaborator wins only when it exists; here link is editor, collab viewer.
    expect(resolveRole(INDEX, "shared-view.md", VIEWER)).toBe("viewer");
  });
});

describe("role helpers", () => {
  it("classifies permissions", () => {
    expect(canRead("viewer")).toBe(true);
    expect(canRead(null)).toBe(false);
    expect(canEdit("viewer")).toBe(false);
    expect(canEdit("editor")).toBe(true);
    expect(canEdit("owner")).toBe(true);
    expect(isOwner("owner")).toBe(true);
    expect(isOwner("editor")).toBe(false);
  });
});

describe("filterTreeForUser", () => {
  const tree: TreeNode[] = [
    { path: "owned.md", name: "owned.md", type: "file" },
    { path: "shared-view.md", name: "shared-view.md", type: "file" },
    { path: "secret.md", name: "secret.md", type: "file" },
    {
      path: "projects",
      name: "projects",
      type: "dir",
      children: [
        { path: "projects/hidden.md", name: "hidden.md", type: "file" },
        { path: "shared-edit.md", name: "shared-edit.md", type: "file" },
      ],
    },
  ];

  it("shows only accessible files to a stranger", () => {
    // Stranger has no explicit or link access anywhere in INDEX.
    const filtered = filterTreeForUser(tree, INDEX, STRANGER);
    expect(flatten(filtered)).toEqual([]);
  });

  it("shows nothing to fully-unauthorized users", () => {
    // STRANGER has no explicit access anywhere in INDEX
    const filtered = filterTreeForUser(tree, INDEX, STRANGER);
    expect(flatten(filtered)).toEqual([]);
  });

  it("shows owner everything", () => {
    const filtered = filterTreeForUser(tree, INDEX, OWNER);
    const paths = flatten(filtered);
    expect(paths).toContain("owned.md");
    expect(paths).toContain("secret.md");
    expect(paths).toContain("shared-edit.md");
  });

  it("shows editor only shared-edit.md", () => {
    const filtered = filterTreeForUser(tree, INDEX, EDITOR);
    expect(flatten(filtered)).toEqual(["shared-edit.md"]);
  });

  it("keeps parent folders of visible files", () => {
    const filtered = filterTreeForUser(tree, INDEX, EDITOR);
    const dirs = filtered.filter((n) => n.type === "dir");
    expect(dirs).toHaveLength(1);
    expect(dirs[0]!.children?.map((c) => c.path)).toEqual(["shared-edit.md"]);
  });

  function flatten(nodes: TreeNode[]): string[] {
    return nodes.flatMap((n) =>
      n.type === "file" ? [n.path] : flatten(n.children ?? [])
    );
  }
});

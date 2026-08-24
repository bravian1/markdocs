import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TreeNode } from "@markdocs/shared";

let root: string;

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "markdocs-test-"));
});

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

/** Import helpers lazily so env-independent modules load cleanly. */
async function load(moduleName: string) {
  return import(moduleName);
}

describe("resolveSafePath", () => {
  it("resolves normal relative paths inside the root", async () => {
    const { resolveSafePath } = await load("./fs/resolve-safe-path");
    const result = resolveSafePath(root, "notes/ideas.md");
    expect(result.startsWith(root)).toBe(true);
    expect(result.endsWith("notes/ideas.md")).toBe(true);
  });

  it("rejects traversal attempts", async () => {
    const { resolveSafePath } = await load("./fs/resolve-safe-path");
    expect(() => resolveSafePath(root, "../escape.md")).toThrow();
    expect(() => resolveSafePath(root, "notes/../../escape.md")).toThrow();
    expect(() => resolveSafePath(root, "/etc/passwd")).toThrow();
  });

  it("assertSafeName rejects bad file names", async () => {
    const { assertSafeName } = await load("./fs/resolve-safe-path");
    expect(() => assertSafeName("ok-name.md")).not.toThrow();
    expect(() => assertSafeName("a/b")).toThrow();
    expect(() => assertSafeName("..")).toThrow();
    expect(() => assertSafeName(".hidden")).toThrow();
    expect(() => assertSafeName("bad:name")).toThrow();
  });
});

describe("document services", () => {
  it("create → list → get → save → delete round trip", async () => {
    const { createDocument } = await load("./services/create-document");
    const { listDocuments } = await load("./services/list-documents");
    const { getDocument } = await load("./services/get-document");
    const { saveDocument } = await load("./services/save-document");
    const { deleteDocument } = await load("./services/delete-document");

    // Create folder + doc
    await createDocument(root, "", "projects", "dir");
    const docPath = await createDocument(root, "projects", "hello world", "file");

    // List
    const tree = await listDocuments(root);
    const dirNode = tree.find((n: TreeNode) => n.name === "projects");
    expect(dirNode?.type).toBe("dir");
    expect(dirNode?.children?.some((c: TreeNode) => c.path === docPath)).toBe(true);

    // Get — title derived from template H1
    const doc = await getDocument(root, docPath);
    expect(doc.title).toBe("hello world"); // from "# hello world"
    expect(doc.content).toContain("# hello world");

    // Save
    await saveDocument(
      root,
      docPath,
      "---\ntitle: Custom Title\n---\n\n# Ignored Heading\n\nBody text here.\n"
    );
    const updated = await getDocument(root, docPath);
    expect(updated.title).toBe("Custom Title");
    expect(updated.frontmatter).toEqual({ title: "Custom Title" });

    // Delete (soft)
    await deleteDocument(root, docPath);
    const afterTree = await listDocuments(root);
    const projects = afterTree.find((n: TreeNode) => n.name === "projects");
    expect(projects?.children?.length ?? 0).toBe(0);
    // Trash contains the removed file
    const trashEntries = await fs.readdir(path.join(root), { withFileTypes: true });
    expect(trashEntries.some((e) => e.name.startsWith(".markdocs-trash"))).toBe(true);
  });
});

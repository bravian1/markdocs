import path from "node:path";
import { listMdDir, type DirEntryInfo } from "../fs/list-md-dir";
import type { TreeNode } from "@markdocs/shared";

/**
 * Recursively build the document tree for a directory.
 * One job: turn flat listings into a tree.
 */
export async function listDocuments(
  root: string,
  relativeDir = ""
): Promise<TreeNode[]> {
  const entries: DirEntryInfo[] = await listMdDir(
    path.join(root, relativeDir),
    relativeDir
  );

  const tree: TreeNode[] = [];
  for (const entry of entries) {
    if (entry.type === "dir") {
      tree.push({
        ...entry,
        children: await listDocuments(root, entry.path),
      });
    } else {
      tree.push({ path: entry.path, name: entry.name, type: "file" });
    }
  }
  return tree;
}

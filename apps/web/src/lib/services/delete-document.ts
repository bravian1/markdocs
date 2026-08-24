import path from "node:path";
import fs from "node:fs/promises";
import { TRASH_DIR } from "../config/docs-root";
import { resolveSafePath } from "../fs/resolve-safe-path";
import { removeAcl } from "../sharing/acl-store";
import { removeDrawing } from "../drawings/drawing-store";

/**
 * Soft-delete a document or folder by moving it into the trash dir.
 * One job: safe removal (ACL entries are dropped with it).
 */
export async function deleteDocument(
  root: string,
  relativePath: string
): Promise<void> {
  const absolute = resolveSafePath(root, relativePath);

  // Refuse to delete the docs root itself.
  if (path.resolve(absolute) === path.resolve(root)) {
    throw new Error("Cannot delete the docs root");
  }

  const trashRoot = path.join(root, TRASH_DIR);
  await fs.mkdir(trashRoot, { recursive: true });

  const uniqueName = `${Date.now()}-${path.basename(relativePath)}`;
  await fs.rename(absolute, path.join(trashRoot, uniqueName));
  await removeAcl(root, relativePath);
  await removeDrawing(root, relativePath);
}

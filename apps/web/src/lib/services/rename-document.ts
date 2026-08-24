import path from "node:path";
import fs from "node:fs/promises";
import { assertSafeName, resolveSafePath } from "../fs/resolve-safe-path";
import { moveAcls } from "../sharing/acl-store";
import { readDrawing, removeDrawing, writeDrawing } from "../drawings/drawing-store";

/**
 * Rename or move a document/folder.
 * One job: rename with safety checks (ACL entries follow).
 */
export async function renameDocument(
  root: string,
  fromPath: string,
  toPath: string
): Promise<void> {
  const from = resolveSafePath(root, fromPath);
  const to = resolveSafePath(root, toPath);
  assertSafeName(path.basename(to));

  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.rename(from, to);
  await moveAcls(root, fromPath, toPath);

  // Follow the drawing sidecar, when one exists.
  const drawing = await readDrawing(root, fromPath);
  if (drawing) {
    await writeDrawing(root, toPath, drawing);
    await removeDrawing(root, fromPath);
  }
}

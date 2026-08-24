import path from "node:path";
import { assertSafeName, resolveSafePath } from "../fs/resolve-safe-path";
import { writeMdFile } from "../fs/write-md-file";
import fs from "node:fs/promises";
import { upsertAcl } from "../sharing/acl-store";

/**
 * Create a new document or folder.
 * Files start with a friendly template; folders are created eagerly.
 * When `ownerId` is provided the new doc is ACL-owned by that user.
 */
export async function createDocument(
  root: string,
  parentPath: string,
  name: string,
  kind: "file" | "dir",
  ownerId?: string
): Promise<string> {
  assertSafeName(name);

  const relativePath =
    kind === "file"
      ? path.posix.join(parentPath, name.toLowerCase().endsWith(".md") ? name : `${name}.md`)
      : path.posix.join(parentPath, name);

  const absolute = resolveSafePath(root, relativePath);

  if (kind === "dir") {
    await fs.mkdir(absolute, { recursive: true });
  } else {
    await assertNotExists(absolute);
    await writeMdFile(absolute, `# ${name}\n\n`);
  }

  if (ownerId) {
    await upsertAcl(root, relativePath, {
      owner: ownerId,
      collaborators: [],
      link: null,
    });
  }

  return relativePath;
}

async function assertNotExists(absolutePath: string): Promise<void> {
  try {
    await fs.access(absolutePath);
    throw new Error(`Already exists: ${absolutePath}`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

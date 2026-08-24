import { resolveSafePath } from "../fs/resolve-safe-path";
import { writeMdFile } from "../fs/write-md-file";
import { readMdFile } from "../fs/read-md-file";
import { snapshotBeforeSave } from "../versions/version-store";

/**
 * Save document content. One job: persist content bytes.
 * Snapshots the previous content first so history is preserved.
 * Frontmatter is preserved because the client sends the full raw content.
 */
export async function saveDocument(
  root: string,
  relativePath: string,
  content: string
): Promise<void> {
  const absolute = resolveSafePath(root, relativePath);

  // Snapshot the on-disk version before overwriting (when it exists).
  try {
    const previous = await readMdFile(absolute);
    await snapshotBeforeSave(root, relativePath, previous);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  await writeMdFile(absolute, content);
}

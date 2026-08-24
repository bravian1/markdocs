import fs from "node:fs/promises";
import path from "node:path";

const MAX_VERSIONS_PER_DOC = 50;

/** Resolve the versions dir for one doc path. One job: path. */
function versionsDir(root: string, relativePath: string): string {
  return path.join(root, ".markdocs", "versions", relativePath);
}

/**
 * Snapshot the current content of a doc before it gets overwritten.
 * Keeps the newest MAX_VERSIONS_PER_DOC snapshots. One job: snapshotting.
 */
export async function snapshotBeforeSave(
  root: string,
  relativePath: string,
  currentContent: string
): Promise<void> {
  const dir = versionsDir(root, relativePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${Date.now()}.md`), currentContent, "utf8");
  await pruneOldVersions(dir);
}

/** Keep only the newest N version files. One job: pruning. */
async function pruneOldVersions(dir: string): Promise<void> {
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md")).sort();
  const excess = files.length - MAX_VERSIONS_PER_DOC;
  for (let i = 0; i < excess; i++) {
    await fs.unlink(path.join(dir, files[i]!)).catch(() => {});
  }
}

export interface VersionInfo {
  /** Snapshot id = file mtime epoch ms. */
  id: string;
  savedAt: string;
  sizeBytes: number;
}

/** List available snapshots for a doc, newest first. One job: listing. */
export async function listVersions(
  root: string,
  relativePath: string
): Promise<VersionInfo[]> {
  try {
    const dir = versionsDir(root, relativePath);
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
    const infos: VersionInfo[] = [];
    for (const file of files) {
      const stat = await fs.stat(path.join(dir, file));
      infos.push({
        id: file.replace(/\.md$/, ""),
        savedAt: stat.mtime.toISOString(),
        sizeBytes: stat.size,
      });
    }
    return infos.sort((a, b) => b.id.localeCompare(a.id));
  } catch {
    return [];
  }
}

/** Read one snapshot's content, or null when missing. One job: read. */
export async function readVersion(
  root: string,
  relativePath: string,
  id: string
): Promise<string | null> {
  // Id must be numeric (epoch) — prevents path traversal via crafted ids.
  if (!/^\d+$/.test(id)) return null;
  try {
    return await fs.readFile(
      path.join(versionsDir(root, relativePath), `${id}.md`),
      "utf8"
    );
  } catch {
    return null;
  }
}

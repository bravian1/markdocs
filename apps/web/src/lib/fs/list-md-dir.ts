import fs from "node:fs/promises";
import { APP_DATA_DIR, TRASH_DIR } from "../config/docs-root";


export interface DirEntryInfo {
  name: string;
  path: string;
  type: "file" | "dir";
}

/**
 * List one directory level: .md files and folders only.
 * Skips hidden entries and app metadata/trash dirs.
 */
export async function listMdDir(
  absoluteDir: string,
  relativeDir = ""
): Promise<DirEntryInfo[]> {
  const dirents = await fs.readdir(absoluteDir, { withFileTypes: true });
  const entries: DirEntryInfo[] = [];

  for (const dirent of dirents) {
    if (dirent.name.startsWith(".") || dirent.name === TRASH_DIR) continue;
    if (dirent.name === APP_DATA_DIR) continue;

    const relPath = relativeDir ? `${relativeDir}/${dirent.name}` : dirent.name;

    if (dirent.isDirectory()) {
      entries.push({ name: dirent.name, path: relPath, type: "dir" });
    } else if (dirent.isFile() && dirent.name.toLowerCase().endsWith(".md")) {
      entries.push({ name: dirent.name, path: relPath, type: "file" });
    }
  }

  return entries.sort(compareEntries);
}

function compareEntries(a: DirEntryInfo, b: DirEntryInfo): number {
  if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
  return a.name.localeCompare(b.name);
}

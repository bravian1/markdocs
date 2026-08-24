import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/** Name of the app metadata dir (permissions index etc.), excluded from trees. */
export const APP_DATA_DIR = ".markdocs";

/** Trash directory for soft deletes. */
export const TRASH_DIR = `${APP_DATA_DIR}-trash`;

/**
 * Resolve the docs root directory.
 * MARKDOCS_ROOT env var wins; defaults to ~/Documents/md-docs.
 * Creates the directory when missing.
 */
export async function getDocsRoot(): Promise<string> {
  const root =
    process.env.MARKDOCS_ROOT ?? path.join(os.homedir(), "Documents", "md-docs");
  await fs.mkdir(root, { recursive: true });
  return root;
}

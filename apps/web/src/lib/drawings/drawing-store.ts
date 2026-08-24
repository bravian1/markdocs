import fs from "node:fs/promises";
import path from "node:path";
import { resolveSafePath } from "../fs/resolve-safe-path";

/** File extension for tldraw snapshot sidecars. */
export const DRAWING_EXT = ".draw.json";

function drawingPath(root: string, docPath: string): string {
  const safe = resolveSafePath(root, docPath);
  return safe + DRAWING_EXT;
}

/**
 * Read the tldraw document snapshot for a doc.
 * Returns null when no drawing exists yet. One job: read.
 */
export async function readDrawing(
  root: string,
  docPath: string
): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(drawingPath(root, docPath), "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Persist a tldraw snapshot next to its doc as `<doc>.draw.json`.
 * One job: write.
 */
export async function writeDrawing(
  root: string,
  docPath: string,
  snapshot: unknown
): Promise<void> {
  // Basic shape check: must be an object with a document payload.
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    !("document" in (snapshot as Record<string, unknown>))
  ) {
    throw new Error("Invalid drawing snapshot");
  }
  const file = drawingPath(root, docPath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(snapshot), "utf8");
}

/** Delete the drawing sidecar when a doc is deleted/renamed. One job: removal. */
export async function removeDrawing(
  root: string,
  docPath: string
): Promise<void> {
  await fs.unlink(drawingPath(root, docPath)).catch(() => {});
}

import fs from "node:fs/promises";
import path from "node:path";
import { extractFrontmatter, deriveTitle, countWords } from "@markdocs/markdown-core";
import { resolveSafePath } from "../fs/resolve-safe-path";
import { readMdFile } from "../fs/read-md-file";
import type { DocumentContent, DocumentMeta } from "@markdocs/shared";

/**
 * Load a single document with derived metadata.
 * One job: read + derive meta for one doc.
 */
export async function getDocument(
  root: string,
  relativePath: string
): Promise<DocumentContent> {
  const absolute = resolveSafePath(root, relativePath);
  const raw = await readMdFile(absolute);
  const { data, content } = extractFrontmatter(raw);
  const stat = await fs.stat(absolute);

  return {
    path: relativePath,
    title: deriveTitle({
      frontmatterTitle: typeof data.title === "string" ? data.title : null,
      content,
      fileName: path.basename(relativePath),
    }),
    content,
    frontmatter: data,
    updatedAt: stat.mtime.toISOString(),
  };
}

/** Derive list-view metadata without loading the full pipeline. */
export async function getDocumentMeta(
  root: string,
  relativePath: string
): Promise<DocumentMeta> {
  const doc = await getDocument(root, relativePath);
  return {
    path: doc.path,
    title: doc.title,
    updatedAt: doc.updatedAt,
    wordCount: countWords(doc.content),
  };
}

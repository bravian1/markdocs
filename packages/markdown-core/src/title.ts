/**
 * Derive a human-readable title for a document.
 * Precedence: frontmatter `title` → first H1 → filename fallback.
 */
export function deriveTitle(input: {
  frontmatterTitle?: string | null;
  content: string;
  fileName: string;
}): string {
  if (input.frontmatterTitle && input.frontmatterTitle.trim()) {
    return input.frontmatterTitle.trim();
  }

  const h1 = findFirstH1(input.content);
  if (h1) return h1;

  return fileNameToTitle(input.fileName);
}

/** Find the first level-1 heading in markdown source. */
function findFirstH1(content: string): string | null {
  const lines = content.split("\n");
  let inFence = false;
  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^#\s+(.+)$/.exec(line);
    if (match) return match[1]!.trim();
  }
  return null;
}

/** "my-cool_doc.md" → "My Cool Doc" */
export function fileNameToTitle(fileName: string): string {
  const base = fileName.replace(/\.md$/i, "");
  const words = base
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return base;
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

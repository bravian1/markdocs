/**
 * Count words in a markdown source string.
 * Strips code fences and frontmatter-ish blocks so counts reflect prose.
 */
export function countWords(source: string): number {
  const withoutFences = source.replace(/```[\s\S]*?```/g, " ");
  const words = withoutFences
    .replace(/[#*_>`~[\]()!-]/g, " ")
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w));
  return words.length;
}

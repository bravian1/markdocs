import matter from "gray-matter";

export interface FrontmatterResult {
  /** Frontmatter key/value pairs (empty object when none present). */
  data: Record<string, unknown>;
  /** Document body with the frontmatter block stripped. */
  content: string;
  /** True when a frontmatter block was present. */
  hasFrontmatter: boolean;
}

/**
 * Extract YAML frontmatter from a markdown document.
 * Single responsibility: frontmatter only — never touches the body.
 */
export function extractFrontmatter(source: string): FrontmatterResult {
  const parsed = matter(source);
  return {
    data: parsed.data,
    content: parsed.content,
    hasFrontmatter: Object.keys(parsed.data).length > 0,
  };
}

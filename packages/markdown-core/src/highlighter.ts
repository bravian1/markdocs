import { createHighlighter, type Highlighter } from "shiki";

let highlighterPromise: Promise<Highlighter> | null = null;

/**
 * Lazily create and cache a shared Shiki highlighter.
 * Keeps bundle of grammars small; extend `langs` as needed.
 */
export function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-dark", "github-light"],
      langs: [
        "typescript",
        "javascript",
        "json",
        "bash",
        "html",
        "css",
        "python",
        "markdown",
      ],
    });
  }
  return highlighterPromise;
}

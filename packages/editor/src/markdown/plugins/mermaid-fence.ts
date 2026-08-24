import type MarkdownIt from "markdown-it";

/**
 * Markdown-it plugin: rename fence tokens whose info string is `mermaid`
 * to `mermaid_fence`, so the PM parser can map them to mermaidBlock nodes
 * instead of regular code blocks.
 */
export function mermaidFencePlugin(md: MarkdownIt): void {
  md.core.ruler.after("block", "markdocs_mermaid_fences", (state) => {
    for (const tok of state.tokens) {
      if (tok.type === "fence" && tok.info?.trim().toLowerCase() === "mermaid") {
        tok.type = "mermaid_fence";
      }
    }
    return true;
  });
}

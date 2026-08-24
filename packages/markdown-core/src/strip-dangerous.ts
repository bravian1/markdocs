import type { Element, Root } from "hast";
import { visit, SKIP } from "unist-util-visit";

const DANGEROUS_TAGS = new Set(["script", "style", "iframe", "object", "embed"]);
const RAW_DANGEROUS = /<\s*\/?\s*(script|style|iframe|object|embed)\b/i;

/**
 * Rehype plugin that removes dangerous content.
 * Handles both parsed elements and raw HTML fragments (when
 * `allowDangerousHtml` keeps them as raw nodes).
 */
export function stripDangerousTags() {
  return (tree: Root) => {
    // Raw HTML fragments.
    visit(tree, "raw", (node: { type: string; value: string }, index, parent) => {
      if (RAW_DANGEROUS.test(node.value) && parent && typeof index === "number") {
        parent.children.splice(index, 1);
        return SKIP;
      }
    });

    // Parsed elements.
    visit(tree, "element", (node: Element, index, parent) => {
      if (DANGEROUS_TAGS.has(node.tagName) && parent && typeof index === "number") {
        parent.children.splice(index, 1);
        return SKIP;
      }
    });
  };
}

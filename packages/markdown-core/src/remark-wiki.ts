import { visit, SKIP } from "unist-util-visit";
import type { Parent, Root } from "mdast";

const WIKI_RE = /\[\[([^\][\n]+)\]\]/g;

interface WikiSegment {
  type: string;
  value?: string;
  data?: { hName: string; hProperties: Record<string, unknown> };
  children?: Array<{ type: string; value: string }>;
}

/**
 * Remark plugin: `[[Target]]` → inline <span class="wiki-link">[[Target]]</span>
 * in exported/preview HTML (via mdast node data.hName).
 */
export function remarkWikiLinks() {
  return (tree: Root) => {
    visit(
      tree,
      "text",
      (
        node: { type: string; value: string },
        index: number | undefined,
        parent: Parent | undefined
      ) => {
        if (!parent || index === undefined || !node.value.includes("[[")) return;
        const value = node.value;

        const segments: WikiSegment[] = [];
        let last = 0;
        for (const match of value.matchAll(WIKI_RE)) {
          const start = match.index ?? 0;
          if (start > last) {
            segments.push({ type: "text", value: value.slice(last, start) });
          }
          segments.push({
            type: "paragraph", // becomes <span> via data.hName
            data: {
              hName: "span",
              hProperties: { className: ["wiki-link"] },
            },
            children: [{ type: "text", value: `[[${match[1]!.trim()}]]` }],
          });
          last = start + match[0].length;
        }
        if (segments.length === 0) return;
        segments.push({ type: "text", value: value.slice(last) });

        parent.children.splice(index, 1, ...(segments as Parent["children"]));
        return [SKIP, index + segments.length];
      }
    );
  };
}

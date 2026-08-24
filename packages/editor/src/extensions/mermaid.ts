import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { MermaidView } from "./mermaid-view";

/**
 * Mermaid diagram block.
 *
 * Markdown form:
 *   ```mermaid
 *   graph TD; A --> B;
 *   ```
 *
 * The source is ProseMirror-managed code content, so editing is
 * transaction-safe; the rendered diagram is a pure preview above it.
 */
export const Mermaid = Node.create({
  name: "mermaidBlock",
  group: "block",
  content: "text*",
  code: true,
  marks: "",
  defining: true,
  isolating: true,

  parseHTML() {
    return [
      {
        tag: "pre[data-mermaid]",
        preserveWhitespace: "full",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "pre",
      mergeAttributes(HTMLAttributes, {
        "data-mermaid": "",
        class: "md-mermaid",
      }),
      ["code", {}, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidView);
  },
});

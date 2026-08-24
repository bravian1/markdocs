import { Node, mergeAttributes, nodeInputRule } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { InlineMathView, BlockMathView } from "./math-view";

/**
 * Inline math: $E = mc^2$
 * Block math:   $$ ... $$
 *
 * LaTeX lives in a `latex` attribute; rendered by KaTeX in MathViews.
 */
const latexAttr = {
  latex: {
    default: "",
    parseHTML: (element: HTMLElement) => element.getAttribute("data-latex") ?? "",
    renderHTML: (attributes: { latex: string }) => ({ "data-latex": attributes.latex }),
  },
};

export const InlineMath = Node.create({
  name: "inlineMath",
  group: "inline",
  inline: true,
  atom: true,
  marks: "",

  addAttributes() {
    return latexAttr;
  },

  parseHTML() {
    return [{ tag: "span[data-math-inline]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-math-inline": "" }),
    ];
  },

  addInputRules() {
    return [
      // $...$ → inline math (requires non-space after opening $)
      nodeInputRule({
        find: /(?:^|\s)\$([^\s$](?:[^$]*[^\s$])?)\$$/,
        type: this.type,
        getAttributes: (match) => ({ latex: match[1] }),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineMathView);
  },
});

export const BlockMath = Node.create({
  name: "blockMath",
  group: "block",
  atom: true,
  defining: true,

  addAttributes() {
    return latexAttr;
  },

  parseHTML() {
    return [{ tag: "div[data-math-block]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-math-block": "" })];
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /\$\$([^$]+)\$\$$/,
        type: this.type,
        getAttributes: (match) => ({ latex: match[1]?.trim() }),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlockMathView);
  },
});

import { Mark, mergeAttributes, markInputRule } from "@tiptap/core";

/**
 * Wiki link mark: [[Target Page]]
 *
 * Rendered as a pill; clicking is handled by the host app via
 * `onWikiLinkOpen` (the editor stays framework/app agnostic).
 */
export const WikiLink = Mark.create({
  name: "wikiLink",
  inclusive: false,

  addAttributes() {
    return {
      target: {
        default: "",
        parseHTML: (element) =>
          element.getAttribute("data-target") ?? element.textContent ?? "",
        renderHTML: (attributes: { target: string }) => ({
          "data-target": attributes.target,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-wiki-link]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-wiki-link": "",
        class: "md-wiki-link",
      }),
      0,
    ];
  },

  addInputRules() {
    // Typing [[Target]] converts to a wiki link mark.
    return [
      markInputRule({
        find: /\[\[([^\][\n]+)\]\]$/,
        type: this.type,
        getAttributes: (match) => ({ target: match[1]?.trim() }),
      }),
    ];
  },
});

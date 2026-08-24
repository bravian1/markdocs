import MarkdownIt from "markdown-it";
import { MarkdownParser } from "prosemirror-markdown";
import type { Schema } from "@tiptap/pm/model";
import { taskListPlugin } from "./plugins/task-lists";
import { mathPlugin } from "./plugins/math";
import { mermaidFencePlugin } from "./plugins/mermaid-fence";
import { wikiLinkPlugin } from "./plugins/wiki-links";
import { tableCellParagraphPlugin } from "./plugins/table-cells";

/**
 * Build a MarkdownParser bound to the editor schema.
 * Supports GFM (tables, strikethrough, task lists), math ($/$$),
 * and mermaid fences.
 */
export function createMarkdownParser(schema: Schema): MarkdownParser {
  const tokenizer = new MarkdownIt("commonmark", { html: false, linkify: false });
  tokenizer.enable(["table", "strikethrough"]);
  tokenizer.use(taskListPlugin);
  tokenizer.use(mathPlugin);
  tokenizer.use(mermaidFencePlugin);
  tokenizer.use(wikiLinkPlugin);
  tokenizer.use(tableCellParagraphPlugin);

  return new MarkdownParser(schema, tokenizer, {
    blockquote: { block: "blockquote" },
    paragraph: { block: "paragraph" },
    list_item: { block: "listItem" },
    task_item: {
      block: "taskItem",
      getAttrs: (tok) => ({ checked: Boolean(tok.meta?.checked) }),
    },
    bullet_list: { block: "bulletList" },
    ordered_list: {
      block: "orderedList",
      getAttrs: (tok) => ({ order: Number(tok.attrGet("order")) || 1 }),
    },
    heading: {
      block: "heading",
      getAttrs: (tok) => ({ level: Number(tok.tag.slice(1)) || 1 }),
    },
    code_block: { block: "codeBlock", noCloseToken: true },
    fence: {
      block: "codeBlock",
      noCloseToken: true,
      getAttrs: (tok) => ({ language: tok.info?.trim() ?? "" }),
    },
    mermaid_fence: { block: "mermaidBlock", noCloseToken: true },
    hr: { node: "horizontalRule" },
    image: {
      node: "image",
      getAttrs: (tok) => ({
        src: tok.attrGet("src"),
        alt: tok.children?.[0]?.content ?? null,
        title: tok.attrGet("title"),
      }),
    },
    hardbreak: { node: "hardBreak" },
    math_inline: {
      node: "inlineMath",
      noCloseToken: true,
      getAttrs: (tok) => ({ latex: tok.content }),
    },
    math_block: {
      node: "blockMath",
      noCloseToken: true,
      getAttrs: (tok) => ({ latex: tok.content }),
    },
    table: { block: "table" },
    tr: { block: "tableRow" },
    th: { block: "tableHeader" },
    td: { block: "tableCell" },

    // Structural table tokens with no ProseMirror counterpart.
    thead: { ignore: true },
    tbody: { ignore: true },
    caption: { ignore: true },
    // markdown-it's alternate plain-text token.
    text_special: { ignore: true },

    // Marks
    em: { mark: "italic" },
    strong: { mark: "bold" },
    s: { mark: "strike" },
    link: {
      mark: "link",
      getAttrs: (tok) => ({
        href: tok.attrGet("href"),
        title: tok.attrGet("title") ?? null,
      }),
    },
    code_inline: { mark: "code", noCloseToken: true },
    wiki_link: {
      mark: "wikiLink",
      getAttrs: (tok) => ({ target: tok.attrGet("data-target") ?? "" }),
    },
  });
}

/**
 * Parse markdown into a ProseMirror document JSON suitable for
 * `editor.commands.setContent`.
 */
export function markdownToDocJSON(schema: Schema, markdown: string): Record<string, unknown> {
  return createMarkdownParser(schema).parse(markdown).toJSON();
}

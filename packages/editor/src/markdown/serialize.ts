import {
  MarkdownSerializer,
  type MarkdownSerializerState,
} from "prosemirror-markdown";
import type { Node as PMNode } from "@tiptap/pm/model";

/** Extract plain text from any node (blocks joined with spaces). */
function nodePlainText(node: PMNode): string {
  const parts: string[] = [];
  node.descendants((child: PMNode) => {
    if (child.isText && child.text) parts.push(child.text);
  });
  return parts.join(" ");
}

/**
 * Markdown serializer covering the full markdocs schema.
 * Built once; reused for every serialization call.
 */
export function createMarkdownSerializer() {
  const nodes = {
    text(state: MarkdownSerializerState, node: PMNode) {
      state.text(String(node.text ?? ""));
    },

    paragraph(state: MarkdownSerializerState, node: PMNode) {
      state.renderInline(node);
      state.closeBlock(node);
    },

    heading(state: MarkdownSerializerState, node: PMNode) {
      state.write(`${state.repeat("#", node.attrs.level)} `);
      state.renderInline(node);
      state.closeBlock(node);
    },

    blockquote(state: MarkdownSerializerState, node: PMNode) {
      state.wrapBlock("> ", null, node, () => state.renderContent(node));
    },

    codeBlock(state: MarkdownSerializerState, node: PMNode) {
      const lang = node.attrs.language ? String(node.attrs.language) : "";
      state.write(`\`\`\`${lang}\n`);
      state.text(String(node.textContent), false);
      state.ensureNewLine();
      state.write("```");
      state.closeBlock(node);
    },

    mermaidBlock(state: MarkdownSerializerState, node: PMNode) {
      state.write("```mermaid\n");
      state.text(String(node.textContent), false);
      state.ensureNewLine();
      state.write("```");
      state.closeBlock(node);
    },

    horizontalRule(state: MarkdownSerializerState, node: PMNode) {
      state.write("---");
      state.closeBlock(node);
    },

    hardBreak(state: MarkdownSerializerState) {
      // Backslash line break — round-trips cleanly through the parser.
      state.write("\\\n");
    },

    bulletList(state: MarkdownSerializerState, node: PMNode) {
      // Per-item markers let task items live in regular bullet lists.
      state.renderList(node, "  ", (index: number) => {
        const child = node.child(index);
        if (child.type.name === "taskItem") {
          return child.attrs.checked ? "- [x] " : "- [ ] ";
        }
        return "- ";
      });
    },

    orderedList(state: MarkdownSerializerState, node: PMNode) {
      const start = Number(node.attrs.order) || 1;
      const maxW = String(start + node.childCount - 1).length;
      const space = state.repeat(" ", maxW + 2);
      state.renderList(node, space, (i: number) => {
        const n = start + i;
        return `${state.repeat(" ", maxW - String(n).length + 1)}${n}. `;
      });
    },

    listItem(state: MarkdownSerializerState, node: PMNode) {
      state.renderContent(node);
    },

    taskItem(state: MarkdownSerializerState, node: PMNode) {
      state.renderContent(node);
    },

    image(state: MarkdownSerializerState, node: PMNode) {
      const title = node.attrs.title
        ? ` "${String(node.attrs.title).replace(/"/g, '\\"')}"`
        : "";
      state.write(
        `![${state.esc(String(node.attrs.alt ?? ""))}](${String(node.attrs.src ?? "")}${title})`
      );
    },

    inlineMath(state: MarkdownSerializerState, node: PMNode) {
      state.write(`$${String(node.attrs.latex)}$`);
    },

    blockMath(state: MarkdownSerializerState, node: PMNode) {
      const latex = String(node.attrs.latex);
      if (latex.includes("\n")) {
        state.write(`$$\n${latex}\n$$`);
      } else {
        state.write(`$$ ${latex} $$`);
      }
      state.closeBlock(node);
    },

    table(state: MarkdownSerializerState, node: PMNode) {
      const rows: string[][] = [];
      node.forEach((row: PMNode) => {
        const cells: string[] = [];
        row.forEach((cell: PMNode) => {
          cells.push(
            nodePlainText(cell).replace(/\|/g, "\\|").replace(/\n/g, " ").trim()
          );
        });
        rows.push(cells);
      });

      const width = Math.max(...rows.map((r) => r.length), 1);
      rows.forEach((cells: string[], i: number) => {
        while (cells.length < width) cells.push("");
        state.write(`| ${cells.join(" | ")} |`);
        state.ensureNewLine();
        if (i === 0) {
          state.write(`| ${Array.from({ length: width }, () => "---").join(" | ")} |`);
          state.ensureNewLine();
        }
      });
      state.closeBlock(node);
    },
  };

  const marks = {
    bold: { open: "**", close: "**", mixable: true, expelEnclosingWhitespace: true },
    italic: { open: "*", close: "*", mixable: true, expelEnclosingWhitespace: true },
    strike: { open: "~~", close: "~~", mixable: true, expelEnclosingWhitespace: true },
    code: { open: "`", close: "`", escape: false },
    wikiLink: {
      open(_state: MarkdownSerializerState, mark: PMNode["marks"][number]) {
        return `[[${String(mark.attrs.target)}]]`;
      },
      close() {
        return "]]";
      },
      mixable: false,
    },
    link: {
      open: "[",
      close(state: MarkdownSerializerState, mark: PMNode["marks"][number]) {
        void state;
        return `](${mark.attrs.href}${mark.attrs.title ? ` "${mark.attrs.title}"` : ""})`;
      },
    },
  };

  return new MarkdownSerializer(nodes, marks);
}

/** Serialize an editor document to markdown. */
export function docToMarkdown(doc: PMNode): string {
  return createMarkdownSerializer().serialize(doc);
}

import type MarkdownIt from "markdown-it";

/**
 * Markdown-it plugin: wrap the inline token of each table cell
 * (`th` / `td`) in hidden paragraph tokens, because ProseMirror
 * table cells require block (paragraph) content while markdown-it
 * emits bare inline tokens for cell contents.
 */
export function tableCellParagraphPlugin(md: MarkdownIt): void {
  md.core.ruler.after("inline", "markdocs_table_cell_paragraphs", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i]!;
      if (tok.type !== "th_open" && tok.type !== "td_open") continue;

      const next = tokens[i + 1];
      if (!next || next.type !== "inline") continue;

      const Token = state.Token;
      const pOpen = new Token("paragraph_open", "p", 1);
      pOpen.hidden = true;
      const pClose = new Token("paragraph_close", "p", -1);
      pClose.hidden = true;

      const inline = new Token("inline", "", 0);
      inline.children = next.children;
      inline.content = next.content;

      tokens.splice(i + 1, 1, pOpen, inline, pClose);
    }
    return true;
  });
}

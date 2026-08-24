import type MarkdownIt from "markdown-it";
import type StateInline from "markdown-it/lib/rules_inline/state_inline.mjs";

/**
 * Markdown-it plugin: `[[Target Page]]` → wiki_link_open/text/wiki_link_close
 * tokens, consumed by the PM parser as wikiLink marks.
 */
export function wikiLinkPlugin(md: MarkdownIt): void {
  md.inline.ruler.before("link", "markdocs_wiki_link", (state: StateInline, silent: boolean) => {
    const { src, pos } = state;
    if (src[pos] !== "[" || src[pos + 1] !== "[") return false;

    const end = src.indexOf("]]", pos + 2);
    if (end === -1) return false;

    const content = src.slice(pos + 2, end);
    if (!content.trim() || /[\n[\]]/.test(content)) return false;

    if (!silent) {
      const open = state.push("wiki_link_open", "span", 1);
      open.attrSet("data-target", content.trim());
      const text = state.push("text", "", 0);
      text.content = content;
      state.push("wiki_link_close", "span", -1);
    }
    state.pos = end + 2;
    return true;
  });
}

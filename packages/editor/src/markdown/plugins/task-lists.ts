import type MarkdownIt from "markdown-it";

interface TokenLike {
  type: string;
  meta: Record<string, unknown> | null;
  content?: string;
  children?: Array<{ type: string; content: string }> | null;
}

/**
 * Markdown-it plugin: detect GitHub-flavored task list items
 * (`- [ ] ` / `- [x] `) and rename their tokens to `task_item_open/close`
 * with `meta.checked`, so the PM parser maps them to TaskItem nodes.
 * Strips the checkbox prefix from item content.
 */
export function taskListPlugin(md: MarkdownIt): void {
  md.core.ruler.after("inline", "markdocs_task_lists", (state) => {
    const tokens = state.tokens as unknown as TokenLike[];
    for (let i = 0; i < tokens.length - 1; i++) {
      const tok = tokens[i]!;
      if (tok.type !== "list_item_open") continue;

      // Find the inline token between this open and its close
      // (a hidden paragraph_open may sit in between).
      let inlineIdx = -1;
      let closeIdx = -1;
      for (let j = i + 1; j < tokens.length; j++) {
        const t = tokens[j]!;
        if (t.type === "inline") {
          inlineIdx = j;
        } else if (t.type === "list_item_close") {
          closeIdx = j;
          break;
        }
      }
      if (inlineIdx === -1 || closeIdx === -1) continue;

      const inline = tokens[inlineIdx]!;
      const inlineContent = inline.content ?? "";
      const match = /^\[([ xX])\]\s+/.exec(inlineContent);
      if (!match) continue;

      tok.meta = { ...(tok.meta ?? {}), checked: match[1] !== " " };
      tok.type = "task_item_open";
      tokens[closeIdx]!.type = "task_item_close";

      inline.content = inlineContent.slice(match[0].length);

      const firstChild = inline.children?.[0];
      if (firstChild) {
        const childMatch = /^\[([ xX])\]\s+/.exec(firstChild.content);
        if (childMatch) {
          firstChild.content = firstChild.content.slice(childMatch[0].length);
          if (!firstChild.content && (inline.children?.length ?? 0) > 1) {
            inline.children!.shift();
            // Drop a leading softbreak left behind by the removed text.
            const nowFirst = inline.children![0];
            if (nowFirst && nowFirst.type === "softbreak") inline.children!.shift();
          }
        }
      }

      // Skip past the close token we already handled.
      i = closeIdx - 1;
    }
    return true;
  });
}



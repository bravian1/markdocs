import type MarkdownIt from "markdown-it";
import type StateInline from "markdown-it/lib/rules_inline/state_inline.mjs";
import type StateBlock from "markdown-it/lib/rules_block/state_block.mjs";

/**
 * Markdown-it plugins for math syntax:
 * - inline:  $E = mc^2$
 * - block:   $$ ... $$ (single or multi line)
 *
 * Emits `math_inline` / `math_block` tokens consumed by the PM parser.
 */

function inlineMathRule(state: StateInline, silent: boolean): boolean {
  const { src, pos } = state;
  if (src[pos] !== "$") return false;
  // Ignore escaped \$ and block-math $$.
  if (pos > 0 && src[pos - 1] === "\\") return false;
  if (src[pos + 1] !== undefined && src[pos + 1] === "$") return false;

  const end = src.indexOf("$", pos + 1);
  if (end === -1 || end === pos + 1) return false;

  const content = src.slice(pos + 1, end);
  if (/^\s/.test(content) || /\s$/.test(content)) return false;

  if (!silent) {
    const token = state.push("math_inline", "math", 0);
    token.markup = "$";
    token.content = content;
  }
  state.pos = end + 1;
  return true;
}

function blockMathRule(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean
): boolean {
  const startPos = state.bMarks[startLine]! + state.tShift[startLine]!;
  const maxPos = state.eMarks[startLine]!;
  const firstLine = state.src.slice(startPos, maxPos);

  if (!firstLine.startsWith("$$")) return false;

  let content: string;
  let lastLine = startLine;

  if (firstLine.length > 4 && firstLine.endsWith("$$")) {
    // Single-line: $$E = mc^2$$
    content = firstLine.slice(2, -2);
  } else {
    // Multi-line: gather until a closing $$ line.
    const lines: string[] = [];
    let found = false;
    for (let line = startLine + 1; line < endLine; line++) {
      const lp = state.bMarks[line]! + state.tShift[line]!;
      const lm = state.eMarks[line]!;
      const text = state.src.slice(lp, lm);
      if (text.trimEnd() === "$$") {
        found = true;
        lastLine = line;
        break;
      }
      lines.push(text);
    }
    if (!found) return false;
    content = lines.join("\n");
  }

  if (silent) return true;

  const token = state.push("math_block", "math", 0);
  token.markup = "$$";
  token.block = true;
  token.content = content.trim();
  state.line = lastLine + 1;
  return true;
}

export function mathPlugin(md: MarkdownIt): void {
  md.inline.ruler.before("escape", "markdocs_math_inline", inlineMathRule);
  md.block.ruler.before("fence", "markdocs_math_block", blockMathRule);
}

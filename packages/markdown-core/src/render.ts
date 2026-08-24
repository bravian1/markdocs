import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import { getHighlighter } from "./highlighter";
import { stripDangerousTags } from "./strip-dangerous";
import { remarkWikiLinks } from "./remark-wiki";

/**
 * Render markdown source to an HTML string.
 * Supports GFM (tables, task lists, strikethrough), math (KaTeX),
 * and syntax-highlighted code fences (Shiki).
 *
 * Mermaid blocks are emitted as <pre class="mermaid-source"> placeholders —
 * the editor hydrates them client-side.
 */
export async function renderMarkdown(source: string): Promise<string> {
  // Highlight code fences before the unified pass by replacing them
  // with pre-rendered HTML kept safe through the pipeline via raw nodes.
  const withHighlightedCode = await highlightFences(source);

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkWikiLinks)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeKatex)
    // Minimal hardening: drop script/style/iframe from rendered output.
    .use(stripDangerousTags)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(withHighlightedCode);

  return String(file);
}

/** Replace fenced code blocks with Shiki-rendered HTML. */
async function highlightFences(source: string): Promise<string> {
  const fenceRegex = /^([ \t]*)(`{3,}|~{3,})[ \t]*(\S*)[^\n]*\n([\s\S]*?)^\1\2[ \t]*$/gm;
  const highlighter = await getHighlighter();
  const parts: string[] = [];
  let lastIndex = 0;

  for (const match of source.matchAll(fenceRegex)) {
    const [full, , , lang = "", code = ""] = match;
    if (!full) continue;
    const indent = match[1] ?? "";
    const start = match.index ?? 0;

    parts.push(source.slice(lastIndex, start));
    lastIndex = start + full.length;

    if (lang.toLowerCase() === "mermaid") {
      parts.push(
        `<pre class="mermaid-source">${escapeHtml(code)}</pre>`
      );
      continue;
    }

    const supported = ["html", "css", "javascript", "js", "jsx", "json", "markdown", "md", "bash", "sh", "python", "typescript", "ts", "tsx"] as const;
    const normalized = lang.toLowerCase() === "js" ? "javascript"
      : lang.toLowerCase() === "ts" ? "typescript"
      : lang.toLowerCase() === "sh" ? "bash"
      : lang.toLowerCase() === "md" ? "markdown"
      : lang.toLowerCase();
    
    let html: string;
    if ((supported as readonly string[]).includes(normalized)) {
      html = highlighter.codeToHtml(code, {
        lang: normalized,
        theme: "github-dark",
      });
    } else {
      html = `<pre class="shiki-plain"><code>${escapeHtml(code)}</code></pre>`;
    }
    parts.push(indent + html);
  }

  parts.push(source.slice(lastIndex));
  return parts.join("");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

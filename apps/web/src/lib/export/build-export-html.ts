import { renderMarkdown } from "@markdocs/markdown-core";
import { getInlinedKatexCss } from "./katex-css";
import { EXPORT_CSS } from "./export-css";
import { renderMermaidToSvg } from "./mermaid-svg";

export interface ExportInput {
  title: string;
  /** Document body (frontmatter already stripped). */
  content: string;
}

/**
 * Escape text for safe interpolation into HTML attribute/text positions.
 * One job: escaping.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Unescape HTML entities produced by markdown-core's placeholder escaping. */
function unescapeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Replace mermaid placeholder blocks with server-rendered SVGs. */
async function inlineMermaidDiagrams(html: string): Promise<string> {
  const placeholder = /<pre class="mermaid-source">([\s\S]*?)<\/pre>/g;
  const parts: string[] = [];
  let lastIndex = 0;

  for (const match of html.matchAll(placeholder)) {
    const [full, encodedSource = ""] = match;
    const start = match.index ?? 0;
    parts.push(html.slice(lastIndex, start));
    lastIndex = start + full.length;

    const svg = await renderMermaidToSvg(unescapeEntities(encodedSource));
    if (svg) {
      parts.push(`<div class="mermaid-svg">${svg}</div>`);
    } else {
      parts.push(`<pre class="mermaid-fallback"><code>${encodedSource}</code></pre>`);
    }
  }

  parts.push(html.slice(lastIndex));
  return parts.join("");
}

/**
 * Build a fully self-contained HTML document for export/print.
 * Includes: rendered markdown (GFM + Shiki + KaTeX), inlined KaTeX CSS with
 * base64 fonts, document styles, and server-rendered mermaid SVGs.
 */
export async function buildExportHtml(input: ExportInput): Promise<string> {
  const bodyHtml = await renderMarkdown(input.content);
  const withDiagrams = await inlineMermaidDiagrams(bodyHtml);
  const katexCss = await getInlinedKatexCss();
  const safeTitle = escapeHtml(input.title);

  // Don't duplicate the title when the document already opens with an H1.
  const startsWithH1 = /^<h1[ >]/.test(withDiagrams.trim());
  const titleBlock = startsWithH1 ? "" : `<h1 class="document-title">${safeTitle}</h1>\n`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<style>${katexCss}</style>
<style>${EXPORT_CSS}</style>
</head>
<body>
<article class="document">
${titleBlock}${withDiagrams}
</article>
</body>
</html>`;
}

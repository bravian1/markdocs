/**
 * Standalone stylesheet for exported documents.
 * Mirrors the app's theme tokens (light palette) so exports match the editor.
 */
export const EXPORT_CSS = `
  :root {
    --bg: #ffffff;
    --fg: #1a1a1a;
    --muted: #555555;
    --border: #e2e2e2;
    --code-bg: #f5f5f5;
    --primary: #333333;
  }
  * { box-sizing: border-box; }
  body {
    background: var(--bg);
    color: var(--fg);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 16px;
    line-height: 1.7;
    margin: 0;
  }
  .document {
    max-width: 46rem;
    margin: 0 auto;
    padding: 3rem 2rem 6rem;
  }
  h1 { font-size: 1.9em; margin-top: 1.4em; }
  h2 { font-size: 1.5em; margin-top: 1.3em; }
  h3 { font-size: 1.22em; margin-top: 1.2em; }
  h4, h5, h6 { font-size: 1.05em; }
  a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
  img { max-width: 100%; border-radius: 6px; }
  blockquote {
    border-left: 3px solid var(--border);
    margin-left: 0;
    padding-left: 1em;
    color: var(--muted);
  }
  pre {
    background: var(--code-bg);
    border-radius: 8px;
    overflow-x: auto;
    padding: 1em;
    font-size: 0.9em;
    line-height: 1.5;
  }
  :not(pre) > code {
    background: var(--code-bg);
    border-radius: 4px;
    padding: 0.15em 0.35em;
    font-size: 0.9em;
  }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid var(--border); padding: 0.45em 0.7em; text-align: left; }
  th { background: var(--code-bg); }
  ul, ol { padding-left: 1.5em; }
  li > p { margin: 0; }
  hr { border: none; border-top: 1px solid var(--border); margin: 2em 0; }
  .katex-display { margin: 0.75em 0; }
  .wiki-link {
    color: var(--fg);
    background: var(--code-bg);
    border-bottom: 1px dashed var(--muted);
    border-radius: 3px;
    padding: 0.05em 0.3em;
  }

  /* Mermaid diagrams (server-rendered SVGs) */
  .mermaid-svg { text-align: center; margin: 1.25em 0; }
  .mermaid-svg svg { max-width: 100%; height: auto; }

  /* Mermaid fallback when server rendering failed */
  .mermaid-fallback {
    border: 1px dashed var(--border);
    border-radius: 8px;
    padding: 1em;
  }
  .mermaid-fallback::before {
    content: "Mermaid diagram (source)";
    display: block;
    font-size: 0.75rem;
    color: var(--muted);
    margin-bottom: 0.5em;
  }

  @media print {
    body { font-size: 12pt; }
    .document { max-width: none; padding: 0; }
    pre, blockquote, table, .mermaid-svg { page-break-inside: avoid; }
  }
`;

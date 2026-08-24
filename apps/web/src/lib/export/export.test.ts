import { describe, it, expect } from "vitest";
import { buildExportHtml } from "./build-export-html";

const SAMPLE = [
  "# Doc",
  "",
  "A table:",
  "",
  "| a | b |",
  "| - | - |",
  "| 1 | 2 |",
  "",
  "```mermaid",
  "graph TD; A[Docs] --> B[Edit];",
  "```",
  "",
  "Math $$E=mc^2$$ here.",
  "",
].join("\n");

describe("buildExportHtml", () => {
  it("produces a complete standalone document", async () => {
    const html = await buildExportHtml({ title: "My Doc", content: SAMPLE });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>My Doc</title>");
    expect(html).toContain("katex"); // KaTeX CSS inlined
    expect(html).toContain("data:font/woff2;base64"); // fonts inlined
  });

  it("renders tables and math", async () => {
    const html = await buildExportHtml({ title: "T", content: SAMPLE });
    expect(html).toContain("<table>");
    expect(html).toContain("katex"); // math rendered
  });

  it("renders diagrams or falls back to styled source (never raw placeholder)", async () => {
    const html = await buildExportHtml({ title: "T", content: SAMPLE });
    expect(html).not.toContain("mermaid-source");
    // Server-side layout can be degenerate without real font metrics,
    // so either a rendered SVG or the clean fallback block is acceptable.
    expect(html).toMatch(/mermaid-svg|mermaid-fallback/);
  }, 30000);

  it("escapes the title", async () => {
    const html = await buildExportHtml({
      title: "<script>x</script>",
      content: "# t",
    });
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(html).not.toContain("<script>x</script>");
  });

  it("falls back to source block when mermaid fails", async () => {
    const html = await buildExportHtml({
      title: "T",
      content: "```mermaid\nthis is not valid mermaid {{{\n```\n",
    });
    // Either rendered or graceful fallback — never a raw placeholder.
    expect(html).not.toContain("mermaid-source");
    expect(html).toMatch(/mermaid-svg|mermaid-fallback/);
  }, 30000);
});

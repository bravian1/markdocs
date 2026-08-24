import { describe, it, expect } from "vitest";
import { extractFrontmatter } from "../src/frontmatter";
import { deriveTitle } from "../src/title";
import { countWords } from "../src/words";
import { renderMarkdown } from "../src/render";

describe("extractFrontmatter", () => {
  it("parses frontmatter and strips it from content", () => {
    const result = extractFrontmatter("---\ntitle: Hello\n---\n\n# Body\n");
    expect(result.data).toEqual({ title: "Hello" });
    expect(result.content).toContain("# Body");
    expect(result.hasFrontmatter).toBe(true);
  });

  it("returns empty data when no frontmatter", () => {
    const result = extractFrontmatter("# Just a doc\n");
    expect(result.data).toEqual({});
    expect(result.hasFrontmatter).toBe(false);
  });
});

describe("deriveTitle", () => {
  it("prefers frontmatter title", () => {
    expect(
      deriveTitle({ frontmatterTitle: "FM Title", content: "# H1", fileName: "f.md" })
    ).toBe("FM Title");
  });

  it("falls back to first H1, ignoring fenced headings", () => {
    const content = "```\n# not a heading\n```\n\n# Real Title\n";
    expect(deriveTitle({ content, fileName: "f.md" })).toBe("Real Title");
  });

  it("falls back to prettified filename", () => {
    expect(deriveTitle({ content: "no heading", fileName: "my-cool_doc.md" })).toBe(
      "My Cool Doc"
    );
  });
});

describe("countWords", () => {
  it("counts words excluding code fences and punctuation", () => {
    const md = "# Hello World\n\nSome prose here.\n\n```js\nconst x = 1;\n```\n";
    expect(countWords(md)).toBe(5); // Hello World Some prose here
  });
});

describe("renderMarkdown", () => {
  it("renders GFM tables", async () => {
    const html = await renderMarkdown("| a | b |\n| - | - |\n| 1 | 2 |\n");
    expect(html).toContain("<table>");
    expect(html).toContain("<th>");
  });

  it("renders task lists", async () => {
    const html = await renderMarkdown("- [x] done\n- [ ] todo\n");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked");
  });

  it("renders math", async () => {
    const html = await renderMarkdown("$$E = mc^2$$\n");
    expect(html).toContain("katex");
  });

  it("highlights code fences", async () => {
    const html = await renderMarkdown("```ts\nconst x: number = 1;\n```\n");
    expect(html).toContain("shiki");
    expect(html).toContain("const");
  });

  it("emits mermaid placeholder blocks", async () => {
    const html = await renderMarkdown("```mermaid\ngraph TD; A-->B;\n```\n");
    expect(html).toContain("mermaid-source");
  });

  it("strips dangerous tags", async () => {
    const html = await renderMarkdown('<script>alert(1)</script>\n\nsafe\n');
    expect(html).not.toContain("<script");
  });
});

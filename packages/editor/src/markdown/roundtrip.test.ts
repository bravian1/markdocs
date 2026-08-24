import { describe, it, expect } from "vitest";
import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { buildExtensions } from "../components/markdocs-editor";
import { createMarkdownParser } from "./parse";
import { createMarkdownSerializer } from "./serialize";

const schema = getSchema(buildExtensions(""));

const SAMPLE = [
  "# Title",
  "",
  "Some **bold** text.",
  "",
  "- [x] done task",
  "- [ ] open task",
  "",
  "```mermaid",
  "graph TD; A-->B;",
  "```",
  "",
  "Inline $E=mc^2$ math.",
  "",
  "$$\\int_0^1 x dx$$",
  "",
  "| Col A | Col B |",
  "| ----- | ----- |",
  "| one   | two   |",
  "",
].join("\n");

describe("markdown ⇄ ProseMirror round trip", () => {
  const doc = createMarkdownParser(schema).parse(SAMPLE);

  it("parses table into table nodes", () => {
    let tables = 0;
    let headers = 0;
    doc.descendants((n) => {
      if (n.type.name === "table") tables++;
      if (n.type.name === "tableHeader") headers++;
    });
    expect(tables).toBe(1);
    expect(headers).toBe(2);
  });

  it("parses task items", () => {
    const tasks: boolean[] = [];
    doc.descendants((n) => {
      if (n.type.name === "taskItem") tasks.push(Boolean(n.attrs.checked));
    });
    expect(tasks).toEqual([true, false]);
  });

  it("parses mermaid block", () => {
    let found = false;
    doc.descendants((n) => {
      if (n.type.name === "mermaidBlock") found = true;
    });
    expect(found).toBe(true);
  });

  it("parses math", () => {
    const kinds = new Set<string>();
    doc.descendants((n) => {
      if (n.type.name === "inlineMath" || n.type.name === "blockMath")
        kinds.add(n.type.name);
    });
    expect(kinds.has("inlineMath")).toBe(true);
    expect(kinds.has("blockMath")).toBe(true);
  });

  it("serializes back to equivalent markdown", () => {
    const md = createMarkdownSerializer().serialize(doc);
    expect(md).toContain("# Title");
    expect(md).toContain("**bold**");
    expect(md).toContain("- [x] done task");
    expect(md).toContain("- [ ] open task");
    expect(md).toContain("```mermaid");
    expect(md).toContain("$E=mc^2$");
    expect(md).toContain("$$ \\int_0^1 x dx $$");
    expect(md).toContain("| Col A | Col B |");
    expect(md).toContain("| one | two |");
  });

  it("second round trip is stable", () => {
    const first = createMarkdownSerializer().serialize(doc);
    const doc2 = createMarkdownParser(schema).parse(first);
    const second = createMarkdownSerializer().serialize(doc2);
    expect(second).toBe(first);
  });

  it("parses and serializes wiki links", () => {
    const src = "See [[Project Notes]] for details.\n";
    const d = createMarkdownParser(schema).parse(src);

    let target: string | null = null;
    d.descendants((n) => {
      const m = n.marks.find((mk) => mk.type.name === "wikiLink");
      if (m) target = String(m.attrs.target);
    });
    expect(target).toBe("Project Notes");

    const out = createMarkdownSerializer().serialize(d);
    expect(out).toContain("[[Project Notes]]");
  });

  it("serializes a plain document without loss", () => {
    const plain = "Hello **world** and `code`.\n\n> quoted\n";
    const d = createMarkdownParser(schema).parse(plain);
    const out = createMarkdownSerializer().serialize(d);
    expect(out).toContain("**world**");
    expect(out).toContain("`code`");
    expect(out).toContain("> quoted");
  });

  it("PMNode.fromJSON accepts parser output", () => {
    const json = doc.toJSON();
    expect(() => PMNode.fromJSON(schema, json)).not.toThrow();
  });
});

import { describe, it, expect } from "vitest";
import MarkdownIt from "markdown-it";
import { taskListPlugin } from "./plugins/task-lists";
import { mathPlugin } from "./plugins/math";
import { mermaidFencePlugin } from "./plugins/mermaid-fence";

function createMd(): MarkdownIt {
  const md = new MarkdownIt("commonmark", { html: false });
  md.enable(["table", "strikethrough"]);
  md.use(taskListPlugin);
  md.use(mathPlugin);
  md.use(mermaidFencePlugin);
  return md;
}

describe("taskListPlugin", () => {
  it("renames task items and strips checkbox prefixes", () => {
    const md = createMd();
    const tokens = md.parse("- [ ] todo\n- [x] done\n- normal\n", {});

    const open = tokens.filter((t) => t.type === "task_item_open");
    expect(open).toHaveLength(2);
    expect(open[0]!.meta?.checked).toBe(false);
    expect(open[1]!.meta?.checked).toBe(true);

    const inline = tokens.find((t) => t.type === "inline" && t.content === "todo");
    expect(inline).toBeDefined();

    // Normal list items untouched
    expect(tokens.some((t) => t.type === "list_item_open")).toBe(true);
  });
});

describe("mathPlugin", () => {
  /** Inline math tokens appear among the paragraph's children tokens. */
  function findChildMath(source: string) {
    const md = createMd();
    const tokens = md.parse(source, {});
    for (const tok of tokens) {
      const child = tok.children?.find((t) => t.type === "math_inline");
      if (child) return child;
    }
    return tokens.find((t) => t.type === "math_inline");
  }

  it("emits math_inline tokens", () => {
    const math = findChildMath("Euler said $e^{i\\pi} = -1$ once\n");
    expect(math?.content).toBe("e^{i\\pi} = -1");
  });

  it("emits math_block tokens for single-line $$", () => {
    const md = createMd();
    const tokens = md.parse("$$E = mc^2$$\n", {});
    const math = tokens.find((t) => t.type === "math_block");
    expect(math?.content).toBe("E = mc^2");
  });

  it("emits math_block tokens for multi-line $$", () => {
    const md = createMd();
    const tokens = md.parse("$$\n\\int_0^1 x dx = \\frac{1}{2}\n$$\n", {});
    const math = tokens.find((t) => t.type === "math_block");
    expect(math?.content).toContain("\\int_0^1");
  });
});

describe("mermaidFencePlugin", () => {
  it("renames mermaid fences", () => {
    const md = createMd();
    const tokens = md.parse("```mermaid\ngraph TD; A-->B;\n```\n", {});
    expect(tokens.some((t) => t.type === "mermaid_fence")).toBe(true);
  });

  it("leaves other fences alone", () => {
    const md = createMd();
    const tokens = md.parse("```ts\nconst x = 1;\n```\n", {});
    expect(tokens.some((t) => t.type === "fence")).toBe(true);
    expect(tokens.some((t) => t.type === "mermaid_fence")).toBe(false);
  });
});

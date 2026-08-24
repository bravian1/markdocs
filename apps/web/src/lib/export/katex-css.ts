import fs from "node:fs/promises";
import path from "node:path";

/**
 * Load KaTeX's stylesheet with all font references inlined as base64
 * data URIs, so exported HTML renders math perfectly offline.
 *
 * Result is cached per process (fonts never change at runtime).
 */
let cached: string | null = null;

/** Locate katex.min.css on disk across install layouts. One job: find file. */
async function findKatexCssPath(): Promise<string> {
  const candidates = [
    // next start / dev run from apps/web
    path.join(process.cwd(), "node_modules/katex/dist/katex.min.css"),
    // vitest runs from the monorepo root
    path.join(process.cwd(), "apps/web/node_modules/katex/dist/katex.min.css"),
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      /* try next */
    }
  }
  throw new Error("katex.min.css not found — is katex installed?");
}

export async function getInlinedKatexCss(): Promise<string> {
  if (cached !== null) return cached;

  const cssPath = await findKatexCssPath();
  const katexDir = path.dirname(cssPath);
  let css = await fs.readFile(cssPath, "utf8");

  // Rewrite every url(...) to a base64 data URI read from disk.
  const urlPattern = /url\((['"]?)([^'")]+)\1\)/g;
  const replacements: Array<Promise<void>> = [];

  css.replace(urlPattern, (_match, quote: string, relUrl: string) => {
    const clean = relUrl.split("?")[0]!;
    const abs = path.resolve(katexDir, clean);
    replacements.push(
      fs
        .readFile(abs)
        .then((buf) => {
          const dataUri = `data:font/woff2;base64,${buf.toString("base64")}`;
          css = css.split(`${quote}${relUrl}${quote}`).join(`${quote}${dataUri}${quote}`);
        })
        .catch((err) => {
          console.error("[export] font inline failed:", abs, err);
        })
    );
    return _match;
  });

  await Promise.all(replacements);
  cached = css;
  return css;
}

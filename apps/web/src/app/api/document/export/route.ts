import { NextRequest, NextResponse } from "next/server";
import { getDocsRoot } from "@/lib/config/docs-root";
import { getDocument } from "@/lib/services/get-document";
import { buildExportHtml } from "@/lib/export/build-export-html";
import { handleRoute, jsonError } from "@/lib/api/route-helpers";
import { docPathSchema } from "@/lib/validation/document-schemas";
import { authorizeDoc } from "@/lib/api/authorize-doc";
import fs from "node:fs/promises";
import path from "node:path";

const FORMATS = new Set(["md", "html"]);

/**
 * GET /api/document/export?path=...&format=md|html
 * Streams a downloadable export of the document (viewer+ required).
 */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const pathParam = request.nextUrl.searchParams.get("path");
    const format = request.nextUrl.searchParams.get("format") ?? "md";

    const pathCheck = docPathSchema.safeParse(pathParam);
    if (!pathCheck.success) return jsonError(400, "Missing or invalid 'path'");
    if (!FORMATS.has(format)) return jsonError(400, "Unsupported format");

    const gate = await authorizeDoc(request, pathCheck.data, "read");
    if (!gate.ok) return gate.response;

    const root = await getDocsRoot();
    const doc = await getDocument(root, pathCheck.data);
    const baseName = path.basename(doc.path).replace(/\.md$/i, "");

    if (format === "md") {
      // Raw markdown — the source of truth, zero transformation.
      const raw = await fs.readFile(path.join(root, pathCheck.data), "utf8");
      return new NextResponse(raw, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${baseName}.md"`,
        },
      });
    }

    const html = await buildExportHtml({ title: doc.title, content: doc.content });
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.html"`,
      },
    });
  });
}

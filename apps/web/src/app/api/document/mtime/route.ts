import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getDocsRoot } from "@/lib/config/docs-root";
import { handleRoute, jsonError } from "@/lib/api/route-helpers";
import { docPathSchema } from "@/lib/validation/document-schemas";
import { authorizeDoc } from "@/lib/api/authorize-doc";

/**
 * GET /api/document/mtime?path=… — cheap liveness check for live sync.
 * Returns { updatedAt } so clients can detect remote edits without
 * downloading the document.
 */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const check = docPathSchema.safeParse(request.nextUrl.searchParams.get("path"));
    if (!check.success) return jsonError(400, "Missing or invalid 'path'");

    const gate = await authorizeDoc(request, check.data, "read");
    if (!gate.ok) return gate.response;

    const root = await getDocsRoot();
    try {
      const stat = await fs.stat(path.join(root, check.data));
      return NextResponse.json({ updatedAt: stat.mtime.toISOString() });
    } catch {
      return jsonError(404, "Not found");
    }
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDocsRoot } from "@/lib/config/docs-root";
import { handleRoute, jsonError, parseJsonBody } from "@/lib/api/route-helpers";
import { docPathSchema } from "@/lib/validation/document-schemas";
import { authorizeDoc } from "@/lib/api/authorize-doc";
import {
  listVersions,
  readVersion,
  snapshotBeforeSave,
} from "@/lib/versions/version-store";
import { readMdFile } from "@/lib/fs/read-md-file";
import { resolveSafePath } from "@/lib/fs/resolve-safe-path";
import { writeMdFile } from "@/lib/fs/write-md-file";

/** GET /api/document/versions?path=… — list snapshots (viewer+). */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const path = request.nextUrl.searchParams.get("path");
    const version = request.nextUrl.searchParams.get("version");

    const check = docPathSchema.safeParse(path);
    if (!check.success) return jsonError(400, "Missing or invalid 'path'");

    const gate = await authorizeDoc(request, check.data, "read");
    if (!gate.ok) return gate.response;

    const root = await getDocsRoot();

    // ?version=<id> → raw content of that snapshot
    if (version) {
      const content = await readVersion(root, check.data, version);
      if (content === null) return jsonError(404, "Version not found");
      return new NextResponse(content, {
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
      });
    }

    return NextResponse.json(await listVersions(root, check.data));
  });
}

const restoreSchema = z.object({
  path: docPathSchema,
  version: z.string().regex(/^\d+$/),
});

/** POST /api/document/versions — snapshot current + restore old (editor+). */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const parsed = await parseJsonBody(request, restoreSchema);
    if (!parsed.ok) return jsonError(400, parsed.message);

    const gate = await authorizeDoc(request, parsed.data.path, "write");
    if (!gate.ok) return gate.response;

    const root = await getDocsRoot();
    const content = await readVersion(root, parsed.data.path, parsed.data.version);
    if (content === null) return jsonError(404, "Version not found");

    // Snapshot what's on disk now, then write the restored content.
    const abs = resolveSafePath(root, parsed.data.path);
    try {
      await snapshotBeforeSave(root, parsed.data.path, await readMdFile(abs));
    } catch {
      /* nothing to snapshot */
    }

    // Direct write — we already snapshotted manually above.
    await writeMdFile(abs, content);
    return NextResponse.json({ ok: true });
  });
}

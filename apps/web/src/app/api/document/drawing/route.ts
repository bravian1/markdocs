import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { PublicUser } from "@markdocs/shared";
import { getDocsRoot } from "@/lib/config/docs-root";
import { authorizeDoc } from "@/lib/api/authorize-doc";
import { handleRoute } from "@/lib/api/route-helpers";
import { readDrawing, writeDrawing } from "@/lib/drawings/drawing-store";

const drawingSchema = z.object({
  path: z.string().min(1),
  snapshot: z.object({ document: z.unknown() }).passthrough(),
});

/** GET /api/document/drawing?path=… → snapshot or null. */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const docPath = request.nextUrl.searchParams.get("path") ?? "";
    const auth = await authorizeDoc(request, docPath, "read");
    if (!auth.ok) return auth.response;

    const root = await getDocsRoot();
    const snapshot = await readDrawing(root, docPath);
    return NextResponse.json({ path: docPath, snapshot });
  });
}

/** PUT /api/document/drawing { path, snapshot } → persisted. */
export async function PUT(request: NextRequest) {
  return handleRoute(async () => {
    let body: z.infer<typeof drawingSchema>;
    try {
      body = drawingSchema.parse(await request.json());
    } catch {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    const auth: { ok: true; user: PublicUser } | { ok: false; response: NextResponse } =
      await authorizeDoc(request, body.path, "write");
    if (!auth.ok) return auth.response;

    const root = await getDocsRoot();
    await writeDrawing(root, body.path, body.snapshot);
    return NextResponse.json({ ok: true });
  });
}

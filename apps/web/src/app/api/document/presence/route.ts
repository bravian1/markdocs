import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDocsRoot } from "@/lib/config/docs-root";
import { handleRoute, jsonError, parseJsonBody } from "@/lib/api/route-helpers";
import { docPathSchema } from "@/lib/validation/document-schemas";
import { authorizeDoc } from "@/lib/api/authorize-doc";
import { recordPresence, readPresence } from "@/lib/sharing/presence-store";

const heartbeatSchema = z.object({
  path: docPathSchema,
});

/** GET /api/document/presence?path=… — who else is viewing right now? */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const check = docPathSchema.safeParse(request.nextUrl.searchParams.get("path"));
    if (!check.success) return jsonError(400, "Missing or invalid 'path'");

    const gate = await authorizeDoc(request, check.data, "read");
    if (!gate.ok) return gate.response;

    const root = await getDocsRoot();
    const others = await readPresence(root, check.data, gate.user.email);
    return NextResponse.json({ others });
  });
}

/** POST /api/document/presence — viewer heartbeat. */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const parsed = await parseJsonBody(request, heartbeatSchema);
    if (!parsed.ok) return jsonError(400, parsed.message);

    const gate = await authorizeDoc(request, parsed.data.path, "read");
    if (!gate.ok) return gate.response;

    const root = await getDocsRoot();
    await recordPresence(root, parsed.data.path, {
      name: gate.user.name,
      email: gate.user.email,
    });
    return NextResponse.json({ ok: true });
  });
}

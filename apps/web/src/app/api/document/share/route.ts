import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { GetShareResponse, PutShareBody, ShareRole } from "@markdocs/shared";
import { getDocsRoot } from "@/lib/config/docs-root";
import { handleRoute, jsonError, parseJsonBody } from "@/lib/api/route-helpers";
import { docPathSchema } from "@/lib/validation/document-schemas";
import { authorizeDoc } from "@/lib/api/authorize-doc";
import { readAclIndex, writeAclIndex } from "@/lib/sharing/acl-store";
import { randomToken } from "@/lib/auth/password";

const putShareSchema = z.object({
  path: docPathSchema,
  collaborators: z
    .array(
      z.object({
        subject: z.string().trim().min(3).max(200),
        role: z.enum(["viewer", "editor"]),
      })
    )
    .max(100),
  linkRole: z.enum(["viewer", "editor"]).nullable(),
  linkToken: z.string().min(10).max(100).optional(),
});

/** GET /api/document/share?path=… — read the ACL (owner only). */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const path = request.nextUrl.searchParams.get("path");
    const check = docPathSchema.safeParse(path);
    if (!check.success) return jsonError(400, "Missing or invalid 'path'");

    const gate = await authorizeDoc(request, check.data, "own");
    if (!gate.ok) return gate.response;

    const root = await getDocsRoot();
    const index = await readAclIndex(root);
    const acl = index[check.data];
    if (!acl) return jsonError(404, "No ACL for this document");

    const body: GetShareResponse = { path: check.data, acl };
    return NextResponse.json(body);
  });
}

/** PUT /api/document/share — update collaborators + link access (owner only). */
export async function PUT(request: NextRequest) {
  return handleRoute(async () => {
    const parsed = await parseJsonBody<PutShareBody>(request, putShareSchema);
    if (!parsed.ok) return jsonError(400, parsed.message);

    const gate = await authorizeDoc(request, parsed.data.path, "own");
    if (!gate.ok) return gate.response;

    const root = await getDocsRoot();
    const index = await readAclIndex(root);
    const existing = index[parsed.data.path];

    // Preserve the token unless rotating or disabling.
    let link: { token: string; role: ShareRole } | null = null;
    if (parsed.data.linkRole) {
      link = {
        token:
          parsed.data.linkToken ??
          existing?.link?.token ??
          randomToken(18),
        role: parsed.data.linkRole,
      };
    }

    index[parsed.data.path] = {
      owner: gate.user.id,
      collaborators: parsed.data.collaborators,
      link,
    };
    await writeAclIndex(root, index);

    return NextResponse.json({ path: parsed.data.path, acl: index[parsed.data.path] });
  });
}

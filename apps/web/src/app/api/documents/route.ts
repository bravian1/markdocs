import { NextRequest, NextResponse } from "next/server";
import type { CreateDocumentBody } from "@markdocs/shared";
import { getDocsRoot } from "@/lib/config/docs-root";
import { listDocuments } from "@/lib/services/list-documents";
import { createDocument } from "@/lib/services/create-document";
import { handleRoute, jsonError, parseJsonBody } from "@/lib/api/route-helpers";
import { createDocumentSchema } from "@/lib/validation/document-schemas";
import { requireUser } from "@/lib/api/require-user";
import { readAclIndex } from "@/lib/sharing/acl-store";
import { filterTreeForUser } from "@/lib/sharing/filter-tree";

/** GET /api/documents — file tree filtered to documents the user can access. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleRoute(async () => {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const root = await getDocsRoot();
    const tree = await listDocuments(root);
    const index = await readAclIndex(root);
    return NextResponse.json(filterTreeForUser(tree, index, auth.user));
  });
}

/** POST /api/documents — create a document or folder owned by the caller. */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const parsed = await parseJsonBody<CreateDocumentBody>(request, createDocumentSchema);
    if (!parsed.ok) return jsonError(400, parsed.message);

    const root = await getDocsRoot();
    const path = await createDocument(
      root,
      parsed.data.parentPath,
      parsed.data.name,
      parsed.data.kind,
      auth.user.id
    );
    return NextResponse.json({ path }, { status: 201 });
  });
}

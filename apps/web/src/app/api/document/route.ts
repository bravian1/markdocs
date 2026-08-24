import { NextRequest, NextResponse } from "next/server";
import type { SaveDocumentBody } from "@markdocs/shared";
import { getDocsRoot } from "@/lib/config/docs-root";
import { getDocument } from "@/lib/services/get-document";
import { saveDocument } from "@/lib/services/save-document";
import { deleteDocument } from "@/lib/services/delete-document";
import { renameDocument } from "@/lib/services/rename-document";
import { handleRoute, jsonError, parseJsonBody } from "@/lib/api/route-helpers";
import {
  docPathSchema,
  renameDocumentSchema,
  saveDocumentSchema,
} from "@/lib/validation/document-schemas";
import { authorizeDoc } from "@/lib/api/authorize-doc";

/** GET /api/document?path=... — load a document (viewer+). */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const path = request.nextUrl.searchParams.get("path");
    const check = docPathSchema.safeParse(path);
    if (!check.success) return jsonError(400, "Missing or invalid 'path'");

    const gate = await authorizeDoc(request, check.data, "read");
    if (!gate.ok) return gate.response;

    const root = await getDocsRoot();
    const doc = await getDocument(root, check.data);
    return NextResponse.json(doc);
  });
}

/** PUT /api/document — save document content (editor+). */
export async function PUT(request: NextRequest) {
  return handleRoute(async () => {
    const parsed = await parseJsonBody<SaveDocumentBody>(request, saveDocumentSchema);
    if (!parsed.ok) return jsonError(400, parsed.message);

    const gate = await authorizeDoc(request, parsed.data.path, "write");
    if (!gate.ok) return gate.response;

    const root = await getDocsRoot();
    await saveDocument(root, parsed.data.path, parsed.data.content);
    const doc = await getDocument(root, parsed.data.path);
    return NextResponse.json({ path: doc.path, updatedAt: doc.updatedAt });
  });
}

/** PATCH /api/document — rename/move (editor+). */
export async function PATCH(request: NextRequest) {
  return handleRoute(async () => {
    const parsed = await parseJsonBody(request, renameDocumentSchema);
    if (!parsed.ok) return jsonError(400, parsed.message);

    const gate = await authorizeDoc(request, parsed.data.path, "write");
    if (!gate.ok) return gate.response;

    const root = await getDocsRoot();
    await renameDocument(root, parsed.data.path, parsed.data.newPath);
    return NextResponse.json({ path: parsed.data.newPath });
  });
}

/** DELETE /api/document?path=... — soft-delete into trash (owner only). */
export async function DELETE(request: NextRequest) {
  return handleRoute(async () => {
    const path = request.nextUrl.searchParams.get("path");
    const check = docPathSchema.safeParse(path);
    if (!check.success) return jsonError(400, "Missing or invalid 'path'");

    const gate = await authorizeDoc(request, check.data, "own");
    if (!gate.ok) return gate.response;

    const root = await getDocsRoot();
    await deleteDocument(root, check.data);
    return NextResponse.json({ ok: true });
  });
}

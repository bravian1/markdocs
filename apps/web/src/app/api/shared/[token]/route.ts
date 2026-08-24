import { NextRequest, NextResponse } from "next/server";
import type { SharedDocumentResponse } from "@markdocs/shared";
import { getDocsRoot } from "@/lib/config/docs-root";
import { getDocument } from "@/lib/services/get-document";
import { readAclIndex } from "@/lib/sharing/acl-store";
import { handleRoute, jsonError } from "@/lib/api/route-helpers";

/**
 * GET /api/shared/[token] — public access for share links.
 * Returns the document when the token is valid; 404 otherwise
 * (404 rather than 403 so tokens aren't confirmable as valid-but-denied).
 */
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  return handleRoute(async () => {
    const { token } = await ctx.params;

    const root = await getDocsRoot();
    const index = await readAclIndex(root);

    // Find the doc whose link token matches.
    let docPath: string | null = null;
    let role: "viewer" | "editor" = "viewer";
    for (const [path, acl] of Object.entries(index)) {
      if (acl.link?.token === token) {
        docPath = path;
        role = acl.link.role;
        break;
      }
    }
    if (!docPath) return jsonError(404, "Not found");

    const doc = await getDocument(root, docPath);
    const body: SharedDocumentResponse = {
      title: doc.title,
      content: doc.content,
      role,
    };
    return NextResponse.json(body);
  });
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { EffectiveRole } from "@markdocs/shared";
import type { PublicUser } from "@markdocs/shared";
import { getDocsRoot } from "../config/docs-root";
import { readAclIndex } from "../sharing/acl-store";
import { canEdit, canRead, isOwner, resolveRole } from "../sharing/resolve-role";
import { requireUser } from "./require-user";

export interface DocAuthContext {
  ok: true;
  user: PublicUser;
  role: EffectiveRole;
}

export interface DocAuthFailure {
  ok: false;
  response: NextResponse;
}

type DocAuthResult = DocAuthContext | DocAuthFailure;

/**
 * Full authorization for a single-document operation.
 * `level`: "read" → viewer+, "write" → editor+, "own" → owner only.
 */
export async function authorizeDoc(
  request: NextRequest,
  docPath: string,
  level: "read" | "write" | "own"
): Promise<DocAuthResult> {
  const auth = await requireUser(request);
  if (!auth.ok) return auth;

  const root = await getDocsRoot();
  const index = await readAclIndex(root);
  const role = resolveRole(index, docPath, auth.user);

  const allowed =
    level === "read" ? canRead(role) : level === "write" ? canEdit(role) : isOwner(role);

  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Access denied" }, { status: 403 }),
    };
  }

  // role is non-null when allowed.
  return { ok: true, user: auth.user, role: role as EffectiveRole };
}

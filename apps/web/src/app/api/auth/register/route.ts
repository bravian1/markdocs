import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { RegisterBody } from "@markdocs/shared";
import { getDocsRoot } from "@/lib/config/docs-root";
import { readAuthStore } from "@/lib/auth/auth-store";
import { createUser } from "@/lib/auth/auth-store";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { claimAllDocsForOwner } from "@/lib/sharing/claim-all-docs";
import { handleRoute, jsonError, parseJsonBody } from "@/lib/api/route-helpers";

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(100),
});

/**
 * POST /api/auth/register — bootstrap the FIRST account only.
 * The new owner claims all pre-existing documents.
 */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const parsed = await parseJsonBody<RegisterBody>(request, registerSchema);
    if (!parsed.ok) return jsonError(400, "Invalid registration details");

    const root = await getDocsRoot();
    const store = await readAuthStore(root);
    if (store.users.length > 0) {
      return jsonError(403, "Setup already completed — sign in instead");
    }

    const user = await createUser(root, parsed.data);
    await claimAllDocsForOwner(root, user.id);

    const token = await createSessionToken(user.id);
    const response = NextResponse.json(
      { id: user.id, email: user.email, name: user.name },
      { status: 201 }
    );
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  });
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "../auth/current-user";
import type { PublicUser } from "@markdocs/shared";

export type AuthedContext =
  | { ok: true; user: PublicUser }
  | { ok: false; response: NextResponse };

/**
 * Require an authenticated user for a route handler.
 * Controllers call this first; it returns either the user or a
 * ready-to-send 401 response. One job: gating.
 */
export async function requireUser(request: NextRequest): Promise<AuthedContext> {
  const user = await getCurrentUser(request);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }
  return { ok: true, user };
}

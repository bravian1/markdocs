import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./session";
import { readAuthStore, findUserById } from "./auth-store";
import { getDocsRoot } from "../config/docs-root";
import type { PublicUser } from "@markdocs/shared";

/**
 * Resolve the authenticated user from a request's session cookie.
 * Returns null when unauthenticated. One job: cookie → user.
 */
export async function getCurrentUser(
  request: NextRequest
): Promise<PublicUser | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const userId = await verifySessionToken(token);
  if (!userId) return null;

  const root = await getDocsRoot();
  const store = await readAuthStore(root);
  const user = findUserById(store, userId);
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name };
}

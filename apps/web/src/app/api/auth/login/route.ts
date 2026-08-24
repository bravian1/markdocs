import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { LoginBody } from "@markdocs/shared";
import { getDocsRoot } from "@/lib/config/docs-root";
import { findUserByEmail, readAuthStore } from "@/lib/auth/auth-store";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { handleRoute, jsonError, parseJsonBody } from "@/lib/api/route-helpers";
import { attemptKey, consumeAttempt } from "@/lib/auth/rate-limit";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
});

/** POST /api/auth/login — verify credentials and set the session cookie. */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    if (!consumeAttempt(attemptKey(request, "login"))) {
      return jsonError(429, "Too many attempts — try again in a minute");
    }

    const parsed = await parseJsonBody<LoginBody>(request, loginSchema);
    if (!parsed.ok) return jsonError(400, "Invalid credentials format");

    const root = await getDocsRoot();
    const store = await readAuthStore(root);
    const user = findUserByEmail(store, parsed.data.email);

    // Uniform failure message — never reveal whether the email exists.
    if (
      !user ||
      !verifyPassword(parsed.data.password, user.salt, user.passwordHash)
    ) {
      return jsonError(401, "Incorrect email or password");
    }

    const token = await createSessionToken(user.id);
    const response = NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  });
}

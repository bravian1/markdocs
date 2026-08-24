import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { handleRoute } from "@/lib/api/route-helpers";

/** POST /api/auth/logout — clear the session cookie. */
export async function POST() {
  return handleRoute(async () => {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  });
}

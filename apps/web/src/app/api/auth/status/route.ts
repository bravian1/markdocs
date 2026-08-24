import { NextRequest, NextResponse } from "next/server";
import type { AuthStatusResponse, PublicUser } from "@markdocs/shared";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDocsRoot } from "@/lib/config/docs-root";
import { readAuthStore } from "@/lib/auth/auth-store";
import { handleRoute } from "@/lib/api/route-helpers";

/** GET /api/auth/status — setup state + current user. */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const root = await getDocsRoot();
    const store = await readAuthStore(root);
    const user = await getCurrentUser(request);

    const body: AuthStatusResponse = {
      needsSetup: store.users.length === 0,
      user: (user as PublicUser | null) ?? null,
    };
    return NextResponse.json(body);
  });
}

import { NextRequest, NextResponse } from "next/server";
import type { ApiError } from "@markdocs/shared";

/**
 * Shared helpers for API route handlers.
 * Controllers stay thin; these centralize response formatting.
 */

export function jsonError(status: number, message: string): NextResponse<ApiError> {
  return NextResponse.json({ error: message }, { status });
}

/** Parse and validate a JSON body against a zod-like schema. */
export async function parseJsonBody<T>(
  request: NextRequest,
  schema: {
    safeParse(data: unknown):
      | { success: true; data: T }
      | { success: false; error?: unknown };
  }
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, message: "Invalid JSON body" };
  }
  const result = schema.safeParse(body);
  if (!result.success) return { ok: false, message: "Validation failed" };
  return { ok: true, data: result.data };
}

/** Wrap a handler so unexpected errors become clean 500s. */
export async function handleRoute(
  fn: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return jsonError(404, "Not found");
    if ((err as Error).name === "UnsafePathError") {
      return jsonError(400, (err as Error).message);
    }
    console.error("[api]", err);
    return jsonError(500, (err as Error).message || "Internal error");
  }
}

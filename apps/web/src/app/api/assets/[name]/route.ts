import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getDocsRoot } from "@/lib/config/docs-root";
import { handleRoute, jsonError } from "@/lib/api/route-helpers";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

/**
 * GET /api/assets/[name] — serve uploaded images.
 * Public by design: names are unguessable random hex, which lets shared
 * (read-only) views display images without auth.
 */
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ name: string }> }
) {
  return handleRoute(async () => {
    const { name } = await ctx.params;
    // Strict name check — no separators, hex + known extension only.
    if (!/^[a-f0-9]{16}\.(png|jpe?g|gif|webp|svg)$/.test(name)) {
      return jsonError(400, "Invalid asset name");
    }

    const root = await getDocsRoot();
    try {
      const file = await fs.readFile(
        path.join(root, ".markdocs", "assets", name)
      );
      return new NextResponse(new Uint8Array(file), {
        headers: {
          "Content-Type": CONTENT_TYPES[path.extname(name)] ?? "application/octet-stream",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      return jsonError(404, "Not found");
    }
  });
}

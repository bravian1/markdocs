import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getDocsRoot } from "@/lib/config/docs-root";
import { handleRoute, jsonError } from "@/lib/api/route-helpers";
import { requireUser } from "@/lib/api/require-user";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]);

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

/**
 * POST /api/uploads — multipart image upload (auth required).
 * Stored under .markdocs/assets/ with an unguessable name;
 * served publicly via /api/assets/[name].
 */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return jsonError(400, "Expected multipart/form-data");
    }

    const file = form.get("file");
    if (!(file instanceof File)) return jsonError(400, "Missing 'file' field");
    if (!ALLOWED.has(file.type)) return jsonError(415, `Unsupported type: ${file.type || "unknown"}`);
    if (file.size > MAX_BYTES) return jsonError(413, "Image exceeds 10MB limit");

    const root = await getDocsRoot();
    const assetsDir = path.join(root, ".markdocs", "assets");
    await fs.mkdir(assetsDir, { recursive: true });

    const name = `${crypto.randomBytes(8).toString("hex")}${EXT_BY_TYPE[file.type]}`;
    await fs.writeFile(path.join(assetsDir, name), Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({ url: `/api/assets/${name}` }, { status: 201 });
  });
}

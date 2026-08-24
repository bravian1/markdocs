import crypto from "node:crypto";

export const SESSION_COOKIE = "markdocs_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Signed session token: `userId.expiry.hmac(secret, userId.expiry)`.
 * Stateless — no server-side session store needed.
 */

/** Get (or lazily create) the server secret from the auth store. */
async function getSecret(): Promise<string> {
  const [{ readAuthStore, writeAuthStore }, root] = await Promise.all([
    import("./auth-store"),
    import("../config/docs-root").then((m) => m.getDocsRoot()),
  ]);
  const store = await readAuthStore(root);

  if (store.secret) return store.secret;
  const secret = crypto.randomBytes(32).toString("hex");
  await writeAuthStore(root, { ...store, secret });
  return secret;
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Create a signed session token for a user. One job: minting. */
export async function createSessionToken(userId: string): Promise<string> {
  const secret = await getSecret();
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * Verify a session token.
 * Returns the userId, or null when invalid/expired/tampered.
 */
export async function verifySessionToken(
  token: string | undefined | null
): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts as [string, string, string];

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;

  const secret = await getSecret();
  const expected = sign(`${userId}.${expStr}`, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  return userId;
}

/** Cookie attributes for the session cookie. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production" && process.env.MARKDOCS_INSECURE_COOKIES !== "1",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  };
}

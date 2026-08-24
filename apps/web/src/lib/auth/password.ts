import crypto from "node:crypto";

const KEYLEN = 64;

/** Hash a password with scrypt and a random salt. One job: hashing. */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEYLEN).toString("hex");
  return { hash, salt };
}

/** Constant-time password verification. One job: verifying. */
export function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string
): boolean {
  const actual = crypto.scryptSync(password, salt, KEYLEN);
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

/** URL-safe random token (share links, secrets). */
export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

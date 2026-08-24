import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { PublicUser } from "@markdocs/shared";

/** Stored user record (password material never leaves the server). */
export interface StoredUser extends PublicUser {
  passwordHash: string;
  salt: string;
}

export interface AuthStore {
  /** HMAC secret for session tokens; generated on first save. */
  secret?: string;
  users: StoredUser[];
}

/** Resolve the auth store file path. One job: path. */
function authStorePath(root: string): string {
  return path.join(root, ".markdocs", "auth.json");
}

/** Read the auth store; empty store when missing. One job: read. */
export async function readAuthStore(root: string): Promise<AuthStore> {
  try {
    const raw = await fs.readFile(authStorePath(root), "utf8");
    const parsed = JSON.parse(raw) as Partial<AuthStore>;
    return { secret: parsed.secret, users: parsed.users ?? [] };
  } catch {
    return { users: [] };
  }
}

/** Persist the auth store (creates .markdocs dir). One job: write. */
export async function writeAuthStore(root: string, store: AuthStore): Promise<void> {
  const file = authStorePath(root);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(store, null, 2), "utf8");
}

/** Find a user by email (case-insensitive). One job: lookup. */
export function findUserByEmail(store: AuthStore, email: string): StoredUser | undefined {
  const needle = email.trim().toLowerCase();
  return store.users.find((u) => u.email.toLowerCase() === needle);
}

/** Find a user by id. One job: lookup. */
export function findUserById(store: AuthStore, userId: string): StoredUser | undefined {
  return store.users.find((u) => u.id === userId);
}

/** Create a user with hashed credentials. One job: creation. */
export async function createUser(
  root: string,
  input: { email: string; password: string; name: string }
): Promise<StoredUser> {
  const { hashPassword } = await import("./password");
  const store = await readAuthStore(root);
  const { hash, salt } = hashPassword(input.password);
  const user: StoredUser = {
    id: crypto.randomUUID(),
    email: input.email.trim().toLowerCase(),
    name: input.name.trim() || input.email.trim().toLowerCase(),
    passwordHash: hash,
    salt,
  };
  store.users.push(user);
  await writeAuthStore(root, store);
  return user;
}

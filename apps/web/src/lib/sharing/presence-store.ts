import fs from "node:fs/promises";
import path from "node:path";

const PRESENCE_TTL_MS = 12_000;

interface PresenceEntry {
  name: string;
  email: string;
  at: number;
}

type PresenceIndex = Record<string, Record<string, PresenceEntry>>;

function presencePath(root: string): string {
  return path.join(root, ".markdocs", "presence.json");
}

/**
 * Record a viewer heartbeat for a doc. One job: write heartbeat.
 */
export async function recordPresence(
  root: string,
  docPath: string,
  user: { name: string; email: string }
): Promise<void> {
  let index: PresenceIndex = {};
  try {
    index = JSON.parse(await fs.readFile(presencePath(root), "utf8"));
  } catch {
    /* fresh */
  }
  const now = Date.now();
  const doc = index[docPath] ?? {};

  // Prune expired entries across all docs while we're here.
  for (const key of Object.keys(index)) {
    for (const subject of Object.keys(index[key]!)) {
      if (now - index[key]![subject]!.at > PRESENCE_TTL_MS) delete index[key]![subject];
    }
    if (Object.keys(index[key]!).length === 0) delete index[key];
  }

  doc[user.email] = { name: user.name, email: user.email, at: now };
  index[docPath] = doc;

  await fs.mkdir(path.dirname(presencePath(root)), { recursive: true });
  await fs.writeFile(presencePath(root), JSON.stringify(index), "utf8");
}

/** List live viewers (within TTL) for a doc, excluding one email. */
export async function readPresence(
  root: string,
  docPath: string,
  excludeEmail?: string
): Promise<Array<{ name: string; email: string }>> {
  try {
    const index: PresenceIndex = JSON.parse(
      await fs.readFile(presencePath(root), "utf8")
    );
    const now = Date.now();
    return Object.values(index[docPath] ?? {})
      .filter((e) => now - e.at <= PRESENCE_TTL_MS && e.email !== excludeEmail)
      .map((e) => ({ name: e.name, email: e.email }));
  } catch {
    return [];
  }
}

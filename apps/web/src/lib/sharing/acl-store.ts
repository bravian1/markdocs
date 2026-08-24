import fs from "node:fs/promises";
import path from "node:path";
import type { AclIndex } from "@markdocs/shared";

/** Resolve the permissions index file path. One job: path. */
function aclPath(root: string): string {
  return path.join(root, ".markdocs", "permissions.json");
}

/** Read the ACL index; empty when missing. One job: read. */
export async function readAclIndex(root: string): Promise<AclIndex> {
  try {
    const raw = await fs.readFile(aclPath(root), "utf8");
    return JSON.parse(raw) as AclIndex;
  } catch {
    return {};
  }
}

/** Persist the ACL index. One job: write. */
export async function writeAclIndex(root: string, index: AclIndex): Promise<void> {
  const file = aclPath(root);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(index, null, 2), "utf8");
}

/** Set (or replace) the ACL for one doc path. One job: upsert. */
export async function upsertAcl(
  root: string,
  docPath: string,
  acl: AclIndex[string]
): Promise<void> {
  const index = await readAclIndex(root);
  index[docPath] = acl;
  await writeAclIndex(root, index);
}

/** Remove ACL entries for a deleted doc. One job: removal. */
export async function removeAcl(root: string, docPath: string): Promise<void> {
  const index = await readAclIndex(root);
  if (!(docPath in index)) return;
  delete index[docPath];
  await writeAclIndex(root, index);
}

/** Move ACL entries after a rename/move (including into a moved folder). */
export async function moveAcls(root: string, fromPath: string, toPath: string): Promise<void> {
  const index = await readAclIndex(root);
  const prefix = `${fromPath}/`;
  let changed = false;
  for (const key of Object.keys(index)) {
    if (key === fromPath) {
      index[toPath] = index[key]!;
      delete index[key];
      changed = true;
    } else if (key.startsWith(prefix)) {
      index[`${toPath}/${key.slice(prefix.length)}`] = index[key]!;
      delete index[key];
      changed = true;
    }
  }
  if (changed) await writeAclIndex(root, index);
}

import path from "node:path";
import { listMdDir } from "../fs/list-md-dir";
import { readAclIndex, upsertAcl } from "./acl-store";

/** Recursively collect every .md file path under root. One job: walk. */
async function collectPaths(root: string, dir = ""): Promise<string[]> {
  const entries = await listMdDir(path.join(root, dir), dir);
  const paths: string[] = [];
  for (const entry of entries) {
    if (entry.type === "file") paths.push(entry.path);
    else paths.push(...(await collectPaths(root, entry.path)));
  }
  return paths;
}

/**
 * Claim every existing document for a newly-registered owner.
 * Runs once during bootstrap so pre-auth files become owned.
 */
export async function claimAllDocsForOwner(
  root: string,
  ownerId: string
): Promise<number> {
  const index = await readAclIndex(root);
  const paths = await collectPaths(root);
  let claimed = 0;

  for (const docPath of paths) {
    if (index[docPath]) continue; // never clobber existing ACLs
    await upsertAcl(root, docPath, {
      owner: ownerId,
      collaborators: [],
      link: null,
    });
    claimed++;
  }
  return claimed;
}

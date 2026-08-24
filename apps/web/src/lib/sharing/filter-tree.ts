import type { AclIndex, EffectiveRole, PublicUser, TreeNode } from "@markdocs/shared";
import { resolveRole } from "./resolve-role";

/**
 * Filter a document tree down to nodes the user can read.
 * Folders are kept only when they contain visible documents.
 */
export function filterTreeForUser(
  nodes: TreeNode[],
  index: AclIndex,
  user: PublicUser | null
): TreeNode[] {
  const result: TreeNode[] = [];

  for (const node of nodes) {
    if (node.type === "file") {
      const role: EffectiveRole | null = resolveRole(index, node.path, user);
      if (role) result.push(node);
    } else {
      const children = filterTreeForUser(node.children ?? [], index, user);
      if (children.length > 0 || resolveRole(index, node.path, user)) {
        result.push({ ...node, children });
      }
    }
  }

  return result;
}

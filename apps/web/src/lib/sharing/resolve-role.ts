import type { AclIndex, EffectiveRole, PublicUser } from "@markdocs/shared";

/**
 * Resolve a user's effective role on a document.
 * Precedence: owner > direct collaborator > link access.
 * Unauthenticated users only get link access.
 */
export function resolveRole(
  index: AclIndex,
  docPath: string,
  user: PublicUser | null
): EffectiveRole | null {
  const acl = index[docPath];
  if (!acl) return null;

  if (user) {
    if (acl.owner === user.id) return "owner";
    for (const c of acl.collaborators) {
      if (c.subject === user.email || c.subject === user.id) return c.role;
    }
  }

  return acl.link?.role ?? null;
}

/** Role check helper: can the user read this doc? */
export function canRead(role: EffectiveRole | null): boolean {
  return role !== null;
}

/** Role check helper: can the user modify this doc? */
export function canEdit(role: EffectiveRole | null): boolean {
  return role === "owner" || role === "editor";
}

/** Role check helper: is the user the owner? */
export function isOwner(role: EffectiveRole | null): boolean {
  return role === "owner";
}

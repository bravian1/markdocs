/**
 * Shared types & API contract between the web app and packages.
 * Keep this file dependency-free (pure types only).
 */

/** A document or folder entry in the file tree. */
export interface TreeNode {
  /** Relative path from docs root, e.g. "notes/ideas.md". Uses "/" separators. */
  path: string;
  name: string;
  type: "file" | "dir";
  children?: TreeNode[];
}

/** Lightweight metadata for list views / tabs. */
export interface DocumentMeta {
  /** Relative path from docs root. Acts as the document id. */
  path: string;
  title: string;
  /** ISO timestamp of last modification. */
  updatedAt: string;
  wordCount: number;
}

/** Full document payload used by GET and PUT. */
export interface DocumentContent {
  path: string;
  title: string;
  content: string;
  frontmatter: Record<string, unknown>;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// REST contract
// ---------------------------------------------------------------------------

/** GET /api/documents → tree of files & folders. */
export type ListDocumentsResponse = TreeNode[];

/** POST /api/documents { parentPath, name } → created doc meta. */
export interface CreateDocumentBody {
  /** Relative dir to create in; "" means docs root. */
  parentPath: string;
  /** File/folder name without extension for files, raw name for dirs. */
  name: string;
  kind: "file" | "dir";
}

/** GET /api/document?path=... → DocumentContent */

/** PUT /api/document { path, content } → updated meta. */
export interface SaveDocumentBody {
  path: string;
  content: string;
}

/** POST /api/document/rename { path, newPath } */
export interface RenameDocumentBody {
  path: string;
  newPath: string;
}

/** Standard error envelope for all API routes. */
export interface ApiError {
  error: string;
}

// ---------------------------------------------------------------------------
// Auth & sharing
// ---------------------------------------------------------------------------

export type ShareRole = "viewer" | "editor";
/** owner > editor > viewer */
export type EffectiveRole = "owner" | "editor" | "viewer";

/** Public shape of a user (never exposes hashes/secrets). */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

/** GET /api/auth/status */
export interface AuthStatusResponse {
  /** True when no account exists yet — show the owner-setup form. */
  needsSetup: boolean;
  user: PublicUser | null;
}

/** POST /api/auth/register — bootstrap the first (owner) account. */
export interface RegisterBody {
  email: string;
  password: string;
  name: string;
}

/** POST /api/auth/login */
export interface LoginBody {
  email: string;
  password: string;
}

/** A collaborator entry. `subject` is a user email (invites work pre-signup). */
export interface Collaborator {
  subject: string;
  role: ShareRole;
}

/** Per-document access control entry (stored in .markdocs/permissions.json). */
export interface DocAcl {
  owner: string;
  collaborators: Collaborator[];
  /** Anyone-with-link sharing; null disables link access. */
  link: { token: string; role: ShareRole } | null;
}

/** Index of ACLs keyed by doc path. */
export type AclIndex = Record<string, DocAcl>;

/** GET /api/document/share?path=… (owner only) */
export interface GetShareResponse {
  path: string;
  acl: DocAcl;
}

/** PUT /api/document/share */
export interface PutShareBody {
  path: string;
  collaborators: Collaborator[];
  linkRole: ShareRole | null;
  /** Existing token to keep; omit to rotate. */
  linkToken?: string;
}

/** GET /api/shared/[token] → document for public share views. */
export interface SharedDocumentResponse {
  title: string;
  content: string;
  role: EffectiveRole;
}

import path from "node:path";

/** Error thrown when a relative path escapes the docs root. */
export class UnsafePathError extends Error {
  constructor(relativePath: string) {
    super(`Unsafe document path: ${relativePath}`);
    this.name = "UnsafePathError";
  }
}

/**
 * Resolve a relative doc path against the root, guaranteeing the result
 * stays inside the root. Single job: path safety.
 *
 * @returns absolute path
 * @throws UnsafePathError on traversal attempts ("..", absolute paths)
 */
export function resolveSafePath(root: string, relativePath: string): string {
  const normalized = path.posix.normalize(relativePath.replaceAll("\\", "/"));
  if (path.posix.isAbsolute(normalized) || normalized.startsWith("..")) {
    throw new UnsafePathError(relativePath);
  }
  const absolute = path.resolve(root, normalized);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (absolute !== root && !absolute.startsWith(rootWithSep)) {
    throw new UnsafePathError(relativePath);
  }
  return absolute;
}

/** Validate a single path segment (file or folder name). */
export function assertSafeName(name: string): void {
  if (
    !name ||
    name.includes("/") ||
    name.includes("\\") ||
    name.startsWith(".") ||
    name === ".." ||
    /[<>:"|?*\0]/.test(name)
  ) {
    throw new UnsafePathError(name);
  }
}

"use client";

import type {
  CreateDocumentBody,
  DocumentContent,
  SaveDocumentBody,
  TreeNode,
} from "@markdocs/shared";

/**
 * Typed fetch wrappers for the document API.
 * Single responsibility per function; no UI logic here.
 */

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchTree(): Promise<TreeNode[]> {
  return request<TreeNode[]>("/api/documents");
}

export async function createDocument(body: CreateDocumentBody): Promise<{ path: string }> {
  return request("/api/documents", { method: "POST", body: JSON.stringify(body) });
}

export async function fetchDocument(path: string): Promise<DocumentContent> {
  return request(`/api/document?path=${encodeURIComponent(path)}`);
}

export async function saveDocument(body: SaveDocumentBody): Promise<void> {
  await request("/api/document", { method: "PUT", body: JSON.stringify(body) });
}

export async function renameDocument(path: string, newPath: string): Promise<void> {
  await request("/api/document", {
    method: "PATCH",
    body: JSON.stringify({ path, newPath }),
  });
}

export async function deleteDocument(path: string): Promise<void> {
  await request(`/api/document?path=${encodeURIComponent(path)}`, {
    method: "DELETE",
  });
}

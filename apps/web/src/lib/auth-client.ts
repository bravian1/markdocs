"use client";

import type { AuthStatusResponse, PublicUser } from "@markdocs/shared";

/**
 * Typed fetch wrappers for the auth API.
 * Cookies are same-origin → sent automatically.
 */

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function fetchAuthStatus(): Promise<AuthStatusResponse> {
  const res = await fetch("/api/auth/status");
  if (!res.ok) throw new Error(`Status check failed (${res.status})`);
  return res.json() as Promise<AuthStatusResponse>;
}

export async function registerOwner(body: {
  email: string;
  password: string;
  name: string;
}): Promise<PublicUser> {
  return post<PublicUser>("/api/auth/register", body);
}

export async function login(body: {
  email: string;
  password: string;
}): Promise<PublicUser> {
  return post<PublicUser>("/api/auth/login", body);
}

export async function logout(): Promise<void> {
  await post("/api/auth/logout");
}

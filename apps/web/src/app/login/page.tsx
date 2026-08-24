"use client";

import { BookOpenText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAuthStatus, login, registerOwner } from "@/lib/auth-client";

/**
 * Login / first-run setup page.
 * Shows the owner-registration form when no account exists yet.
 */
export default function LoginPage() {
  const router = useRouter();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const status = await fetchAuthStatus();
        if (!status.needsSetup && status.user) {
          router.replace("/");
          return;
        }
        setNeedsSetup(status.needsSetup);
      } catch {
        setError("Could not reach the server.");
      }
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (needsSetup) {
        await registerOwner({ email, password, name });
      } else {
        await login({ email, password });
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-[var(--card-foreground)] shadow-lg"
      >
        <div className="mb-6 flex items-center gap-2">
          <BookOpenText className="h-5 w-5" />
          <span className="text-lg font-semibold tracking-tight">MarkDocs</span>
        </div>

        <h1 className="mb-1 text-xl font-semibold">
          {needsSetup ? "Create your account" : "Sign in"}
        </h1>
        <p className="mb-5 text-sm text-[var(--muted-foreground)]">
          {needsSetup
            ? "You're the first user — this account owns all existing documents."
            : "Sign in to access your documents."}
        </p>

        {needsSetup && (
          <label className="mb-3 block text-sm">
            Name
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="mt-1"
              required
            />
          </label>
        )}

        <label className="mb-3 block text-sm">
          Email
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1"
            required
            autoFocus
          />
        </label>

        <label className="mb-4 block text-sm">
          Password
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={needsSetup ? "At least 8 characters" : "Password"}
            className="mt-1"
            minLength={needsSetup ? 8 : undefined}
            required
          />
        </label>

        {error && (
          <p className="mb-4 rounded-md bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Working…" : needsSetup ? "Create account" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type KeyboardEvent } from "react";
import { safeNextPath } from "@/lib/auth/session";

export function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { businessName?: string | null } | null) => setBusinessName(data?.businessName ?? null))
      .catch(() => undefined);
  }, []);

  const detectCaps = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState?.("CapsLock") ?? false);

  const submit = async () => {
    if (pending) return;
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (response.ok) {
        router.replace(next);
        router.refresh();
        return;
      }
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(payload?.error?.message ?? "Sign in failed. Try again.");
      setPassword("");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  const input = "h-10 w-full rounded border border-zinc-300 bg-white px-3 text-[15px] text-zinc-900 focus:border-zinc-900 focus:outline-none";

  return (
    <main className="flex min-h-dvh items-start justify-center px-4 pt-[14vh] pb-12">
      <div className="w-full max-w-[360px]">
        <p className="text-sm font-semibold tracking-wide text-zinc-900 uppercase">{businessName ?? " "}</p>
        <h1 className="mt-6 text-2xl font-semibold text-zinc-900">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-500">{params.get("next") ? "Sign in to continue." : "Invoices, catalog and settings."}</p>

        <form
          className="mt-8 space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div>
            <label htmlFor="username" className="mb-1 block text-sm text-zinc-700">
              Username
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              maxLength={100}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              onKeyUp={detectCaps}
              className={input}
            />
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <label htmlFor="password" className="text-sm text-zinc-700">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="text-xs text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              maxLength={200}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyUp={detectCaps}
              onKeyDown={detectCaps}
              aria-describedby={capsLock ? "caps-warning" : undefined}
              className={input}
            />
            {capsLock && (
              <p id="caps-warning" className="mt-1 text-xs text-amber-700">
                Caps Lock is on.
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="h-10 w-full rounded bg-zinc-900 text-[15px] font-medium text-white hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-wait disabled:opacity-70"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}

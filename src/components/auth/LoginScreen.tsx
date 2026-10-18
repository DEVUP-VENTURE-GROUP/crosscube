"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type KeyboardEvent } from "react";
import { safeNextPath } from "@/lib/auth/session";

function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="7" fill="currentColor" opacity="0.12" />
      <path d="M10 7.5h9l4.5 4.5v12.5a1 1 0 0 1-1 1h-12.5a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M19 7.5V12h4.5M12.5 16h7M12.5 19.5h7M16 22.8h3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SampleInvoice() {
  const rows = [
    ["Motor Oil 0W-20 1QT", "6.00", "93.60"],
    ["Oil Filter Kit", "1.00", "23.05"],
    ["Shop Supplies", "", "17.50"],
  ];
  return (
    <div aria-hidden="true" className="w-[340px] rotate-[-2deg] rounded-sm bg-white p-5 text-[9px] leading-[1.35] text-slate-900 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.55)] ring-1 ring-black/5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-bold tracking-wide">YOUR SHOP NAME</div>
          <div className="text-slate-500">Street address · City, ST</div>
        </div>
        <div className="text-center">
          <div className="font-bold">INVOICE</div>
          <div className="mt-0.5 rounded-[3px] border border-slate-900 px-3 font-bold">00001</div>
        </div>
      </div>
      <div className="mt-3 border-b-[1.5px] border-slate-900 pb-0.5 text-[12px] font-bold">INVOICE</div>
      <div className="mt-2 grid grid-cols-2 border-t border-slate-900">
        <div className="border-r border-slate-900 pr-2">
          <div className="flex justify-between border-b border-slate-900 py-0.5 font-bold">
            <span>Part Description</span>
            <span>Ext</span>
          </div>
          {rows.map(([name, qty, ext]) => (
            <div key={name} className="flex justify-between py-0.5">
              <span className={qty ? "" : "pl-2"}>{name}</span>
              <span className="tabular-nums">{ext}</span>
            </div>
          ))}
        </div>
        <div className="pl-2">
          <div className="flex justify-between border-b border-slate-900 py-0.5 font-bold">
            <span>Labor Description</span>
            <span>Ext</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span>Oil &amp; Filter Service</span>
            <span className="tabular-nums">110.40</span>
          </div>
          <div className="pl-1.5 text-slate-500">Capacity confirmed per vehicle</div>
          <div className="flex justify-between py-0.5">
            <span>Hazardous Materials</span>
            <span className="tabular-nums">17.50</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <div className="w-32 rounded-[4px] border border-slate-900 px-2 py-1 font-bold">
          {[
            ["SubTotal:", "262.05"],
            ["Tax:", "10.73"],
            ["Total:", "272.78"],
            ["Bal Due:", "$0.00"],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <span>{label}</span>
              <span className="tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const POINTS = [
  { title: "Catalog-priced lines", text: "Search parts, labor and fees; prices come from your catalog." },
  { title: "Totals verified on the server", text: "Every invoice is recalculated before it gets a number." },
  { title: "Print-ready PDF", text: "Your invoice layout, ready to hand to the customer." },
];

export function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(params.get("next") ? "Please sign in to continue." : null);
  const [errorTone, setErrorTone] = useState<"info" | "error">(params.get("next") ? "info" : "error");

  const detectCaps = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState?.("CapsLock") ?? false);

  const submit = async () => {
    if (pending) return;
    if (!username.trim() || !password) {
      setErrorTone("error");
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
      setErrorTone("error");
      setError(payload?.error?.message ?? "Sign in failed. Try again.");
      setPassword("");
    } catch {
      setErrorTone("error");
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  const inputClass =
    "h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-[15px] text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-accent focus:ring-4 focus:ring-accent/15 focus:outline-none";

  return (
    <main className="grid min-h-dvh bg-white lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section
        className="relative hidden overflow-hidden bg-[#0e1f36] text-white lg:flex lg:flex-col"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      >
        <div className="flex items-center gap-2.5 px-12 pt-10">
          <BrandMark className="size-8 text-white" />
          <span className="text-[15px] font-semibold tracking-tight">Invoice Generator</span>
        </div>
        <div className="flex flex-1 flex-col justify-center px-12 xl:px-16">
          <h2 className="max-w-md text-[34px] leading-[1.15] font-semibold tracking-tight">Repair invoices, accurate to the cent.</h2>
          <ul className="mt-8 max-w-md space-y-5">
            {POINTS.map((point) => (
              <li key={point.title} className="flex gap-3.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
                  <svg viewBox="0 0 16 16" className="size-3" aria-hidden="true">
                    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>
                  <span className="block text-[15px] font-medium">{point.title}</span>
                  <span className="block text-sm text-slate-300">{point.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="pointer-events-none absolute right-[-40px] bottom-[-30px] hidden xl:block">
          <SampleInvoice />
        </div>
        <p className="px-12 pb-8 text-xs text-slate-400">For authorized shop staff only.</p>
      </section>

      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-[380px]">
          <div className="mb-10 flex items-center gap-2.5 text-slate-900 lg:hidden">
            <BrandMark className="size-8 text-accent" />
            <span className="text-[15px] font-semibold tracking-tight">Invoice Generator</span>
          </div>

          <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">Sign in</h1>
          <p className="mt-1.5 text-[15px] text-slate-500">Welcome back. Sign in to create and manage invoices.</p>

          <form
            className="mt-8 space-y-5"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            {error && (
              <div
                role={errorTone === "error" ? "alert" : "status"}
                className={`flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm ${
                  errorTone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-blue-200 bg-blue-50 text-blue-900"
                }`}
              >
                <svg viewBox="0 0 20 20" className="mt-px size-4 shrink-0" aria-hidden="true">
                  <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M10 6v4.5M10 13.5v.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700">
                Username
              </label>
              <div className="relative">
                <svg viewBox="0 0 20 20" className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-slate-400" aria-hidden="true">
                  <circle cx="10" cy="7" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M3.8 16.5c1.1-2.8 3.4-4.2 6.2-4.2s5.1 1.4 6.2 4.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
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
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <svg viewBox="0 0 20 20" className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-slate-400" aria-hidden="true">
                  <rect x="4" y="8.5" width="12" height="8.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M7 8.5V6.5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
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
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <svg viewBox="0 0 20 20" className="size-[18px]" aria-hidden="true">
                    <path d="M1.8 10S4.8 4.5 10 4.5 18.2 10 18.2 10 15.2 15.5 10 15.5 1.8 10 1.8 10Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                    <circle cx="10" cy="10" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    {showPassword && <path d="M3 17L17 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
                  </svg>
                </button>
              </div>
              {capsLock && (
                <p id="caps-warning" className="mt-1.5 text-xs font-medium text-amber-700">
                  Caps Lock is on.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={pending}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[15px] font-semibold text-white shadow-sm transition hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-80"
            >
              {pending && (
                <svg viewBox="0 0 20 20" className="size-4 animate-spin" aria-hidden="true">
                  <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.2" />
                  <path d="M17 10a7 7 0 0 0-7-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              )}
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-500">Your session stays signed in on this device for 12 hours.</p>
        </div>
      </section>
    </main>
  );
}

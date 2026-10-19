"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CURRENT_DRAFT_KEY, readStorage } from "@/components/invoice/storage";

const SECONDARY = [
  { href: "/invoices", label: "Invoices" },
  { href: "/customers", label: "Customers" },
  { href: "/catalog", label: "Catalog" },
  { href: "/settings", label: "Settings" },
];

interface SessionInfo {
  username: string | null;
  businessName: string | null;
}

export function AppHeader() {
  const pathname = usePathname();
  const params = useSearchParams();
  const [storedId, setStoredId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionInfo>({ username: null, businessName: null });
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => setStoredId(readStorage(CURRENT_DRAFT_KEY)), [pathname]);
  useEffect(() => {
    if (pathname === "/login") return;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: SessionInfo | null) => data && setSession({ username: data.username, businessName: data.businessName }))
      .catch(() => undefined);
  }, [pathname]);

  if (pathname === "/login") return null;

  const onWorkspace = pathname === "/invoice";
  const invoiceId = (onWorkspace ? params.get("id") : null) ?? storedId;
  const tab = onWorkspace ? (params.get("tab") === "invoice" ? "invoice" : "items") : null;
  const tabHref = (target: string) => `/invoice?${new URLSearchParams({ ...(invoiceId ? { id: invoiceId } : {}), tab: target })}`;

  const signOut = async () => {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    // Full page load: the client router may have cached the signed-in /login → /invoice redirect.
    window.location.assign("/login");
  };

  const linkClass = (active: boolean) =>
    `flex h-12 items-center border-b-2 px-2.5 text-sm ${
      active ? "border-zinc-900 font-medium text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-900"
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-4 px-4">
        <Link href={tabHref("items")} className="hidden max-w-56 truncate text-sm font-bold tracking-wide text-zinc-900 uppercase sm:block">
          {session.businessName ?? "Invoices"}
        </Link>
        <nav aria-label="Invoice" className="flex">
          <Link href={tabHref("items")} className={linkClass(tab === "items")} aria-current={tab === "items" ? "page" : undefined}>
            Add Items
          </Link>
          <Link href={tabHref("invoice")} className={linkClass(tab === "invoice")} aria-current={tab === "invoice" ? "page" : undefined}>
            Create Invoice
          </Link>
        </nav>
        <nav aria-label="Records" className="ml-auto flex">
          {SECONDARY.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(pathname === item.href)} aria-current={pathname === item.href ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        {session.username && (
          <div className="flex items-center gap-1 text-sm text-zinc-500">
            <span className="hidden md:inline">{session.username}</span>
            <span className="hidden md:inline" aria-hidden="true">
              ·
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={signingOut}
              className="px-1 text-zinc-700 underline-offset-4 hover:text-zinc-900 hover:underline disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

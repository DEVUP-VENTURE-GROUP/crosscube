"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CURRENT_DRAFT_KEY, readStorage } from "@/components/invoice/storage";

const SECONDARY = [
  { href: "/invoices", label: "Invoices" },
  { href: "/catalog", label: "Catalog" },
  { href: "/settings", label: "Settings" },
];

function UserMenu() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { username: string | null } | null) => setUsername(data?.username ?? null))
      .catch(() => setUsername(null));
  }, []);
  if (!username) return null;
  const signOut = async () => {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  };
  return (
    <div className="ml-2 flex items-center gap-2 border-l border-slate-200 pl-3">
      <span className="hidden items-center gap-2 text-sm text-slate-600 md:flex">
        <span className="flex size-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white uppercase" aria-hidden="true">
          {username.slice(0, 1)}
        </span>
        <span>{username}</span>
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        disabled={signingOut}
        className="h-8 rounded-md px-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const params = useSearchParams();
  const [storedId, setStoredId] = useState<string | null>(null);
  useEffect(() => setStoredId(readStorage(CURRENT_DRAFT_KEY)), [pathname]);
  if (pathname === "/login") return null;

  const onWorkspace = pathname === "/invoice";
  const invoiceId = (onWorkspace ? params.get("id") : null) ?? storedId;
  const tab = onWorkspace ? (params.get("tab") === "invoice" ? "invoice" : "items") : null;
  const tabHref = (target: string) => `/invoice?${new URLSearchParams({ ...(invoiceId ? { id: invoiceId } : {}), tab: target })}`;

  const tabClass = (active: boolean) =>
    `relative flex h-12 items-center px-3 text-sm font-medium transition-colors ${
      active ? "text-accent after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-accent" : "text-slate-600 hover:text-slate-900"
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-2 px-4">
        <Link href={tabHref("items")} className="mr-3 hidden text-sm font-semibold tracking-tight text-slate-900 sm:block">
          Invoice Generator
        </Link>
        <nav aria-label="Invoice" className="flex">
          <Link href={tabHref("items")} className={tabClass(tab === "items")} aria-current={tab === "items" ? "page" : undefined}>
            Add Items
          </Link>
          <Link href={tabHref("invoice")} className={tabClass(tab === "invoice")} aria-current={tab === "invoice" ? "page" : undefined}>
            Create Invoice
          </Link>
        </nav>
        <nav aria-label="Records" className="ml-auto flex">
          {SECONDARY.map((item) => (
            <Link key={item.href} href={item.href} className={tabClass(pathname === item.href)} aria-current={pathname === item.href ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <UserMenu />
      </div>
    </header>
  );
}

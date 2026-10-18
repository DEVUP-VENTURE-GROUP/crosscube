"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CURRENT_DRAFT_KEY, readStorage } from "@/components/invoice/storage";

const SECONDARY = [
  { href: "/invoices", label: "Invoices" },
  { href: "/catalog", label: "Catalog" },
  { href: "/settings", label: "Settings" },
];

export function AppHeader() {
  const pathname = usePathname();
  const params = useSearchParams();
  const [storedId, setStoredId] = useState<string | null>(null);
  useEffect(() => setStoredId(readStorage(CURRENT_DRAFT_KEY)), [pathname]);

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
      </div>
    </header>
  );
}

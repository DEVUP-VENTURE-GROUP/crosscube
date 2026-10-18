"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button } from "@/components/ui/controls";
import { api, ApiError, downloadFile } from "@/lib/http/client";
import { formatCents } from "@/lib/money/money";
import type { InvoiceStatus, InvoiceSummary } from "@/modules/invoices/invoice.types";

const FILTERS: { value: InvoiceStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Drafts" },
  { value: "FINALIZED", label: "Finalized" },
  { value: "VOID", label: "Void" },
];

const STATUS_TONE = { DRAFT: "slate", FINALIZING: "amber", FINALIZED: "green", VOID: "red" } as const;

export function InvoiceHistory() {
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const [items, setItems] = useState<InvoiceSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(
    async (after: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: "25", ...(status ? { status } : {}), ...(after ? { cursor: after } : {}) });
        const page = await api<{ items: InvoiceSummary[]; nextCursor: string | null }>(`/api/invoices?${params}`);
        setItems((current) => (after ? [...current, ...page.items] : page.items));
        setCursor(page.nextCursor);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not load invoices.");
      } finally {
        setLoading(false);
      }
    },
    [status],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  const download = async (id: string) => {
    if (downloading) return;
    setDownloading(id);
    try {
      await downloadFile(`/api/invoices/${id}/pdf`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Download failed.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Invoices</h1>
        <div role="tablist" aria-label="Filter by status" className="flex rounded-md border border-slate-200 bg-white p-0.5">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              role="tab"
              aria-selected={status === filter.value}
              className={`rounded px-3 py-1 text-sm ${status === filter.value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              onClick={() => setStatus(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <Link href="/invoice" className="ml-auto text-sm font-medium text-accent hover:underline">
          Open current draft
        </Link>
      </div>
      {error && (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-3 py-2">Number</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Vehicle</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium tabular-nums">
                  <Link href={`/invoice?id=${item.id}&tab=invoice`} className="text-accent hover:underline">
                    {item.invoiceNumber ?? "Draft"}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <span className="flex gap-1">
                    <Badge tone={STATUS_TONE[item.status]}>{item.status.toLowerCase()}</Badge>
                    {item.isDemo && <Badge tone="amber">demo</Badge>}
                  </span>
                </td>
                <td className="max-w-48 truncate px-3 py-2">{item.customerName || <span className="text-slate-400">—</span>}</td>
                <td className="max-w-56 truncate px-3 py-2 text-slate-600">{item.vehicleLabel || <span className="text-slate-400">—</span>}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCents(item.totalCents)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCents(item.balanceCents)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-600">{new Date(item.finalizedAt ?? item.updatedAt).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" className="h-8 text-xs" disabled={downloading !== null} onClick={() => void download(item.id)}>
                    {downloading === item.id ? "Preparing…" : "PDF"}
                  </Button>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  No invoices{status ? ` with status ${status.toLowerCase()}` : ""} yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex justify-center">
        {loading && <span className="text-sm text-slate-500">Loading…</span>}
        {!loading && cursor && <Button onClick={() => void load(cursor)}>Load more</Button>}
      </div>
    </main>
  );
}

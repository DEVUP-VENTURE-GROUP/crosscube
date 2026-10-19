"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, ConfirmButton } from "@/components/ui/controls";
import { api, ApiError } from "@/lib/http/client";
import { formatCents } from "@/lib/money/money";
import { computeInvoice, type CatalogLookup } from "@/modules/invoices/invoice.compute";
import type { Invoice } from "@/modules/invoices/invoice.types";
import type { DocumentSource } from "@/modules/pdf/invoice-document-model";
import { toBusinessSnapshot } from "@/modules/settings/settings.types";
import { InvoiceEditor } from "./InvoiceEditor";
import { InvoicePreview } from "./InvoicePreview";
import { InvoiceReview } from "./InvoiceReview";
import { CURRENT_DRAFT_KEY, PENDING_CREATE_KEY, readStorage, writeStorage } from "./storage";
import type { ReferenceData } from "./types";
import { useInvoiceDraft, type SaveState } from "./useInvoiceDraft";

type Tab = "items" | "invoice";

export function InvoiceWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const tab: Tab = params.get("tab") === "invoice" ? "invoice" : "items";

  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = useCallback((invoiceId: string, nextTab: Tab) => router.replace(`/invoice?id=${encodeURIComponent(invoiceId)}&tab=${nextTab}`, { scroll: false }), [router]);

  const createNew = useCallback(async () => {
    setError(null);
    const key = readStorage(PENDING_CREATE_KEY, "session") ?? crypto.randomUUID();
    writeStorage(PENDING_CREATE_KEY, key, "session");
    try {
      const result = await api<{ invoice: Invoice }>("/api/invoices", { method: "POST", body: { idempotencyKey: key } });
      writeStorage(PENDING_CREATE_KEY, null, "session");
      setInvoice(result.invoice);
      go(result.invoice.id, "items");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create a new invoice.");
    }
  }, [go]);

  useEffect(() => {
    api<ReferenceData>("/api/reference-data").then(setReference, (e: unknown) =>
      setError(e instanceof ApiError ? e.message : "Could not load catalog and settings."),
    );
  }, []);

  useEffect(() => {
    if (invoice && invoice.id === id) return;
    if (invoice && !id) {
      go(invoice.id, tab);
      return;
    }
    let cancelled = false;
    (async () => {
      const candidate = id ?? readStorage(CURRENT_DRAFT_KEY);
      if (candidate) {
        try {
          const result = await api<{ invoice: Invoice }>(`/api/invoices/${encodeURIComponent(candidate)}`);
          if (cancelled) return;
          if (id || result.invoice.status === "DRAFT") {
            setInvoice(result.invoice);
            if (!id) go(candidate, tab);
            return;
          }
        } catch (e) {
          if (cancelled) return;
          if (id) {
            setError(e instanceof ApiError && e.status === 404 ? "That invoice does not exist." : e instanceof ApiError ? e.message : "Could not load the invoice.");
            return;
          }
        }
      }
      if (!cancelled) await createNew();
    })();
    return () => {
      cancelled = true;
    };
  }, [id, invoice, tab, go, createNew]);

  useEffect(() => {
    if (invoice) writeStorage(CURRENT_DRAFT_KEY, invoice.status === "DRAFT" ? invoice.id : null);
  }, [invoice]);

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <Alert>{error}</Alert>
        <div className="mt-4 flex gap-2">
          <Button variant="primary" onClick={() => void createNew()}>
            Start a new invoice
          </Button>
          <Link href="/invoices" className="inline-flex h-9 items-center px-3 text-sm text-zinc-900 underline underline-offset-4 hover:no-underline">
            View invoices
          </Link>
        </div>
      </main>
    );
  }
  if (!reference || !invoice || invoice.id !== id) {
    return (
      <main className="mx-auto max-w-[1600px] px-4 py-6" aria-busy="true">
        <div className="h-6 w-48 animate-pulse rounded bg-zinc-200" />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="h-96 animate-pulse rounded bg-zinc-200/70" />
          <div className="h-96 animate-pulse rounded bg-zinc-200/70" />
        </div>
        <span className="sr-only">Loading invoice…</span>
      </main>
    );
  }
  return (
    <DraftWorkspace
      key={invoice.id}
      initial={invoice}
      reference={reference}
      tab={tab}
      onTab={(next) => go(invoice.id, next)}
      onNew={() => void createNew()}
      onOpen={(next) => {
        setInvoice(next);
        go(next.id, "items");
      }}
      onDeleted={() => {
        writeStorage(CURRENT_DRAFT_KEY, null);
        router.push("/invoices");
      }}
    />
  );
}

function SaveIndicator({ state, status }: { state: SaveState; status: Invoice["status"] }) {
  if (status !== "DRAFT") return null;
  const text = {
    idle: "All changes saved",
    dirty: "Unsaved changes…",
    saving: "Saving…",
    saved: "All changes saved",
    error: "Save failed — retrying",
    conflict: "Changed elsewhere — reload",
  }[state.kind];
  const tone = state.kind === "error" || state.kind === "conflict" ? "text-red-700" : "text-zinc-500";
  return (
    <span className={`text-xs ${tone}`} role="status" aria-live="polite">
      {text}
    </span>
  );
}

function DraftWorkspace({
  initial,
  reference,
  tab,
  onTab,
  onNew,
  onOpen,
  onDeleted,
}: {
  initial: Invoice;
  reference: ReferenceData;
  tab: Tab;
  onTab: (tab: Tab) => void;
  onNew: () => void;
  onOpen: (invoice: Invoice) => void;
  onDeleted: () => void;
}) {
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const state = useInvoiceDraft(initial);
  const { invoice, draft, editable, saveState } = state;
  const [reviewed, setReviewed] = useState(tab === "invoice");
  useEffect(() => {
    if (tab === "invoice") setReviewed(true);
  }, [tab]);

  const lookup: CatalogLookup = useMemo(
    () => ({
      items: new Map(reference.catalog.map((item) => [item.id, item])),
      taxCategories: new Map(reference.taxCategories.map((category) => [category.id, category])),
    }),
    [reference],
  );
  const computed = useMemo(
    () => computeInvoice(draft, lookup, { shopSuppliesInParts: reference.settings.shopSuppliesInParts }),
    [draft, lookup, reference.settings.shopSuppliesInParts],
  );

  const source: DocumentSource = editable
    ? {
        status: "DRAFT",
        isDemo: invoice.isDemo,
        invoiceNumber: null,
        estimateNumber: draft.estimateNumber,
        originalEstimateCents: draft.originalEstimateCents,
        serviceDate: draft.serviceDate,
        finalizedAt: null,
        customer: draft.customer,
        vehicle: draft.vehicle,
        lines: computed.lines,
        totals: computed.totals,
        payments: draft.payments,
        notes: draft.notes,
        shopSuppliesInParts: reference.settings.shopSuppliesInParts,
      }
    : invoice;
  const business = invoice.business ?? toBusinessSnapshot(reference.settings);
  const totals = editable ? computed.totals : invoice.totals;

  return (
    <main className="mx-auto max-w-[1600px] px-4 pt-4 pb-28 lg:pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
          {invoice.invoiceNumber ? `Invoice ${invoice.invoiceNumber}` : "Draft invoice"}
        </h1>
        {invoice.status === "DRAFT" && <Badge>Draft</Badge>}
        {invoice.status === "FINALIZED" && <Badge tone="green">Finalized</Badge>}
        {invoice.status === "VOID" && <Badge tone="red">Void</Badge>}
        {invoice.status === "FINALIZING" && <Badge tone="amber">Finalizing</Badge>}
        {invoice.isDemo && <Badge tone="amber">Demo record</Badge>}
        <SaveIndicator state={saveState} status={invoice.status} />
        <div className="ml-auto flex items-center gap-2">
          {invoice.status === "DRAFT" && (
            <ConfirmButton
              label="Delete draft"
              question="Delete this draft?"
              onConfirm={async () => {
                setDeleteError(null);
                try {
                  await state.flush();
                  await api(`/api/invoices/${invoice.id}`, { method: "DELETE" });
                  onDeleted();
                } catch (e) {
                  setDeleteError(e instanceof ApiError ? e.message : "Could not delete the draft.");
                }
              }}
            />
          )}
          <Button variant="ghost" onClick={onNew}>
            New invoice
          </Button>
        </div>
      </div>
      {deleteError && (
        <div className="mb-4">
          <Alert>{deleteError}</Alert>
        </div>
      )}
      {saveState.kind === "conflict" && (
        <div className="mb-4">
          <Alert>
            {saveState.message}{" "}
            <button type="button" className="font-medium underline" onClick={() => window.location.reload()}>
              Reload
            </button>
          </Alert>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="min-w-0">
          {tab === "items" ? (
            <InvoiceEditor state={state} computed={computed} reference={reference} showRequired={reviewed} onReview={() => onTab("invoice")} />
          ) : (
            <InvoiceReview state={state} computed={computed} onEditItems={() => onTab("items")} onOpen={onOpen} />
          )}
        </div>
        <div className="min-w-0 lg:sticky lg:top-16">
          <InvoicePreview source={source} business={business} />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3">
          <div className="min-w-0">
            <div className="text-xs text-zinc-500">Total</div>
            <div className="text-base font-semibold tabular-nums">{formatCents(totals.totalCents)}</div>
          </div>
          <div className="ml-auto">
            {tab === "items" ? (
              <Button variant="primary" onClick={() => onTab("invoice")}>
                Review &amp; create
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => document.getElementById("invoice-actions")?.scrollIntoView({ behavior: "smooth" })}>
                Finalize &amp; download
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

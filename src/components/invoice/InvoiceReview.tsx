"use client";

import { useState } from "react";
import { Alert, Button, Field, MoneyInput, Panel, Select, TextArea, TextInput } from "@/components/ui/controls";
import { api, ApiError, downloadFile } from "@/lib/http/client";
import { formatCents } from "@/lib/money/money";
import type { ComputedInvoice } from "@/modules/invoices/invoice.compute";
import { PAYMENT_METHODS, type Invoice, type Issue, type Payment, type PaymentMethod } from "@/modules/invoices/invoice.types";
import { formatCalendarDate } from "@/modules/pdf/invoice-document-model";
import { InvoiceTotals } from "./InvoiceTotals";
import { IssueList } from "./IssueList";
import type { useInvoiceDraft } from "./useInvoiceDraft";

type Busy = null | "finalize" | "download" | "payment" | "void" | "reissue";

const METHOD_LABELS: Record<PaymentMethod, string> = { CASH: "Cash", CARD: "Card", CHECK: "Check", OTHER: "Other" };

function today(): string {
  return new Date().toLocaleDateString("en-CA");
}

function PaymentForm({ defaultAmount, busy, onSubmit, submitLabel }: { defaultAmount: number; busy: boolean; onSubmit: (payment: Payment) => void; submitLabel: string }) {
  const [method, setMethod] = useState<PaymentMethod>("CARD");
  const [amount, setAmount] = useState<number | null>(defaultAmount > 0 ? defaultAmount : null);
  const [receivedAt, setReceivedAt] = useState(today());
  const [reference, setReference] = useState("");
  const valid = amount !== null && amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(receivedAt);
  return (
    <form
      className="grid grid-cols-2 gap-3 sm:grid-cols-[8rem_8rem_10rem_minmax(0,1fr)_auto] sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        onSubmit({ id: crypto.randomUUID(), method, amountCents: amount, receivedAt, reference: reference.trim() });
        setReference("");
      }}
    >
      <Field label="Method">
        {(id) => (
          <Select id={id} value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Amount">{(id) => <MoneyInput id={id} value={amount} onCommit={setAmount} />}</Field>
      <Field label="Received">{(id) => <TextInput id={id} type="date" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} />}</Field>
      <Field label="Reference">{(id) => <TextInput id={id} value={reference} maxLength={80} placeholder="Last 4, check #…" onChange={(event) => setReference(event.target.value)} />}</Field>
      <Button type="submit" variant="secondary" disabled={!valid || busy} className="col-span-2 sm:col-span-1">
        {submitLabel}
      </Button>
    </form>
  );
}

export function InvoiceReview({
  state,
  computed,
  onEditItems,
  onOpen,
}: {
  state: ReturnType<typeof useInvoiceDraft>;
  computed: ComputedInvoice;
  onEditItems: () => void;
  onOpen: (invoice: Invoice) => void;
}) {
  const { invoice, draft, update, editable, finalize, saveState, replaceInvoice } = state;
  const [busy, setBusy] = useState<Busy>(null);
  const [confirming, setConfirming] = useState(false);
  const [serverIssues, setServerIssues] = useState<Issue[]>([]);
  const [message, setMessage] = useState<{ tone: "red" | "green" | "blue"; text: string } | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<void>) => {
    if (busy) return;
    setBusy(kind);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      setServerIssues(apiError?.issues ?? []);
      setMessage({ tone: "red", text: apiError?.message ?? "Something went wrong. Try again." });
    } finally {
      setBusy(null);
    }
  };

  const download = () => run("download", () => downloadFile(`/api/invoices/${invoice.id}/pdf`));

  if (editable) {
    const errors = computed.issues.filter((issue) => issue.severity === "error");
    const warnings = computed.issues.filter((issue) => issue.severity === "warning");
    const saving = saveState.kind === "saving" || saveState.kind === "dirty";
    return (
      <div className="space-y-4">
        <Panel title="Review" actions={<Button variant="ghost" className="h-8 text-xs" onClick={onEditItems}>Edit items</Button>}>
          {errors.length === 0 && warnings.length === 0 && <p className="text-sm text-emerald-800">All required details are present and totals are verified against the catalog.</p>}
          <IssueList issues={[...errors, ...warnings]} />
        </Panel>

        <Panel title="Payments received">
          {draft.payments.length > 0 && (
            <ul className="mb-3 divide-y divide-slate-100 text-sm">
              {draft.payments.map((payment) => (
                <li key={payment.id} className="flex items-center gap-3 py-1.5">
                  <span className="w-24 text-slate-600">{formatCalendarDate(payment.receivedAt)}</span>
                  <span className="w-14">{METHOD_LABELS[payment.method]}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-500">{payment.reference}</span>
                  <span className="tabular-nums">{formatCents(payment.amountCents)}</span>
                  <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => update((d) => ({ ...d, payments: d.payments.filter((p) => p.id !== payment.id) }))}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <PaymentForm
            key={`${draft.payments.length}-${computed.totals.balanceCents}`}
            defaultAmount={computed.totals.balanceCents}
            busy={false}
            submitLabel="Add payment"
            onSubmit={(payment) => update((d) => ({ ...d, payments: [...d.payments, payment] }))}
          />
        </Panel>

        <Panel title="Invoice notes">
          <Field label="Printed on the invoice" hint="Optional. Recommendations, follow-up work, or other notes for the customer.">
            {(id, describedBy) => (
              <TextArea id={id} aria-describedby={describedBy} rows={3} maxLength={4000} value={draft.notes} onChange={(event) => update((d) => ({ ...d, notes: event.target.value }))} />
            )}
          </Field>
        </Panel>

        <section id="invoice-actions" aria-label="Create invoice" className="rounded-lg border border-slate-200 bg-white p-4">
          <InvoiceTotals totals={computed.totals} />
          {message && (
            <div className="mt-3">
              <Alert tone={message.tone}>{message.text}</Alert>
              {serverIssues.length > 0 && (
                <div className="mt-2">
                  <IssueList issues={serverIssues} />
                </div>
              )}
            </div>
          )}
          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
            {!confirming ? (
              <Button variant="primary" disabled={errors.length > 0 || busy !== null} onClick={() => setConfirming(true)}>
                Finalize invoice
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 p-2" role="group" aria-label="Confirm finalization">
                <span className="text-sm text-slate-700">Assign a permanent number and lock all prices?</span>
                <Button
                  variant="primary"
                  disabled={busy !== null}
                  onClick={() =>
                    run("finalize", async () => {
                      setServerIssues([]);
                      const result = await finalize();
                      setConfirming(false);
                      setMessage({ tone: "green", text: `Invoice ${result.invoiceNumber} created.` });
                    })
                  }
                >
                  {busy === "finalize" ? "Finalizing…" : "Confirm & finalize"}
                </Button>
                <Button variant="ghost" disabled={busy !== null} onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            )}
            <Button variant="secondary" disabled={busy !== null || saving} onClick={() => void download()}>
              {busy === "download" ? "Preparing PDF…" : "Download draft PDF"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Finalizing recalculates every total on the server, assigns the next invoice number, and stores an unchangeable snapshot. Draft PDFs are watermarked.
          </p>
        </section>
      </div>
    );
  }

  const finalized = invoice.status === "FINALIZED";
  return (
    <div className="space-y-4">
      <section id="invoice-actions" aria-label="Invoice" className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Invoice</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{invoice.invoiceNumber}</p>
            {invoice.finalizedAt && <p className="text-xs text-slate-500">Finalized {new Date(invoice.finalizedAt).toLocaleString()}</p>}
          </div>
          <Button variant="primary" disabled={busy !== null} onClick={() => void download()}>
            {busy === "download" ? "Preparing PDF…" : "Download PDF"}
          </Button>
        </div>
        {message && (
          <div className="mt-3">
            <Alert tone={message.tone}>{message.text}</Alert>
            {serverIssues.length > 0 && <IssueList issues={serverIssues} />}
          </div>
        )}
        {invoice.status === "VOID" && (
          <div className="mt-3">
            <Alert>Void: {invoice.voidReason}</Alert>
          </div>
        )}
        <div className="mt-4 border-t border-slate-100 pt-3">
          <InvoiceTotals totals={invoice.totals} />
        </div>
      </section>

      {finalized && invoice.totals.balanceCents > 0 && (
        <Panel title="Record payment">
          <PaymentForm
            key={invoice.version}
            defaultAmount={invoice.totals.balanceCents}
            busy={busy !== null}
            submitLabel={busy === "payment" ? "Saving…" : "Record payment"}
            onSubmit={(payment) =>
              void run("payment", async () => {
                const result = await api<{ invoice: Invoice }>(`/api/invoices/${invoice.id}/payments`, { method: "POST", body: { version: invoice.version, payment } });
                replaceInvoice(result.invoice);
                setMessage({ tone: "green", text: `Payment of ${formatCents(payment.amountCents)} recorded.` });
              })
            }
          />
        </Panel>
      )}

      {finalized && (
        <Panel title="Corrections">
          <p className="mb-3 text-sm text-slate-600">Finalized invoices cannot be edited. Void this invoice, then reissue it as a new draft with a new number.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Reason for voiding" className="flex-1">
              {(id) => <TextInput id={id} value={voidReason} maxLength={500} onChange={(event) => setVoidReason(event.target.value)} />}
            </Field>
            <Button
              variant="danger"
              disabled={busy !== null || voidReason.trim().length < 3}
              onClick={() =>
                void run("void", async () => {
                  const result = await api<{ invoice: Invoice }>(`/api/invoices/${invoice.id}/void`, { method: "POST", body: { reason: voidReason.trim() } });
                  replaceInvoice(result.invoice);
                })
              }
            >
              {busy === "void" ? "Voiding…" : "Void invoice"}
            </Button>
          </div>
        </Panel>
      )}

      {invoice.status === "VOID" && (
        <Panel title="Reissue">
          <p className="mb-3 text-sm text-slate-600">Create a new draft with this invoice’s customer, vehicle and lines. Prices are re-checked against the current catalog when it is finalized.</p>
          <Button
            variant="primary"
            disabled={busy !== null}
            onClick={() =>
              void run("reissue", async () => {
                const result = await api<{ invoice: Invoice }>(`/api/invoices/${invoice.id}/reissue`, { method: "POST" });
                onOpen(result.invoice);
              })
            }
          >
            {busy === "reissue" ? "Creating draft…" : "Reissue as new draft"}
          </Button>
        </Panel>
      )}

      <Panel title="History">
        <ol className="space-y-1 text-sm">
          {invoice.events.map((event, index) => (
            <li key={index} className="flex gap-3">
              <span className="w-40 shrink-0 text-slate-500">{new Date(event.at).toLocaleString()}</span>
              <span>
                {event.type.replace(/_/g, " ").toLowerCase()}
                {event.type === "PRICE_OVERRIDE" && ` · ${event.details.catalogPrice} → ${event.details.usedPrice} (${event.details.reason})`}
                {event.type === "PAYMENT_RECORDED" && ` · ${formatCents(Number(event.details.amountCents))}`}
                {event.type === "VOIDED" && ` · ${event.details.reason}`}
              </span>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

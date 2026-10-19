import { randomInt } from "node:crypto";
import { MongoServerError } from "mongodb";
import type { Collections, InvoiceDoc } from "@/lib/db/collections";
import { db } from "@/lib/db/mongo";
import { conflict, notFound, validationFailed } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging/logger";
import { formatCents } from "@/lib/money/money";
import { loadCatalogLookup } from "@/modules/catalog/catalog.service";
import { upsertCustomer, upsertVehicle } from "@/modules/customers/customer.service";
import { readSettings } from "@/modules/settings/settings.service";
import { toBusinessSnapshot, type NumberingMode } from "@/modules/settings/settings.types";
import { computeInvoice, hasErrors, type ComputedInvoice } from "./invoice.compute";
import { formatInvoiceNumber, MAX_GAP, MIN_GAP } from "./invoice-number.service";
import { draftFromDoc, findInvoicePage, toInvoice } from "./invoice.repository";
import { EMPTY_CUSTOMER, EMPTY_VEHICLE, type Invoice, type InvoiceEvent, type InvoiceStatus, type Issue, type Payment } from "./invoice.types";
import type { DraftInput } from "./invoice.validation";

const STALE_LOCK_MS = 60_000;
const IN_PROGRESS_WAIT_MS = 8_000;
const IN_PROGRESS_POLL_MS = 250;

export const EMPTY_DRAFT: DraftInput = {
  customerId: null,
  vehicleId: null,
  customer: EMPTY_CUSTOMER,
  vehicle: EMPTY_VEHICLE,
  estimateNumber: "",
  originalEstimateCents: null,
  serviceDate: "",
  notes: "",
  lines: [],
  payments: [],
};

function isDuplicateKey(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000;
}

async function computeDraft(c: Collections, draft: DraftInput): Promise<ComputedInvoice & { shopSuppliesInParts: boolean }> {
  const [settings, lookup] = await Promise.all([readSettings(c), loadCatalogLookup(draft.lines.map((line) => line.catalogItemId))]);
  const options = { shopSuppliesInParts: settings.shopSuppliesInParts };
  return { ...computeInvoice(draft, lookup, options), ...options };
}

function draftFields(draft: DraftInput, computed: ComputedInvoice & { shopSuppliesInParts: boolean }) {
  return {
    customerId: draft.customerId,
    vehicleId: draft.vehicleId,
    customer: draft.customer,
    vehicle: draft.vehicle,
    estimateNumber: draft.estimateNumber,
    originalEstimateCents: draft.originalEstimateCents,
    serviceDate: draft.serviceDate,
    notes: draft.notes,
    lines: computed.lines,
    payments: draft.payments,
    totals: computed.totals,
    shopSuppliesInParts: computed.shopSuppliesInParts,
  };
}

async function insertDraft(
  c: Collections,
  draft: DraftInput,
  extra: { idempotencyKey: string; revisionOfId?: string | null; isDemo?: boolean; events?: InvoiceEvent[] },
): Promise<Invoice> {
  const existing = await c.invoices.findOne({ idempotencyKey: extra.idempotencyKey });
  if (existing) return toInvoice(existing);
  const now = new Date();
  const computed = await computeDraft(c, draft);
  const doc: InvoiceDoc = {
    _id: crypto.randomUUID(),
    status: "DRAFT",
    invoiceNumber: null,
    sequenceNumber: null,
    idempotencyKey: extra.idempotencyKey,
    version: 1,
    isDemo: extra.isDemo ?? false,
    ...draftFields(draft, computed),
    business: null,
    revisionOfId: extra.revisionOfId ?? null,
    voidReason: "",
    events: [{ type: "CREATED", at: now.toISOString(), details: {} }, ...(extra.events ?? [])],
    lock: null,
    reservedSequence: null,
    createdAt: now,
    updatedAt: now,
    finalizedAt: null,
    voidedAt: null,
  };
  try {
    await c.invoices.insertOne(doc);
    return toInvoice(doc);
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const winner = await c.invoices.findOne({ idempotencyKey: extra.idempotencyKey });
    if (!winner) throw error;
    return toInvoice(winner);
  }
}

export async function createDraft(idempotencyKey: string, draft: DraftInput = EMPTY_DRAFT, isDemo = false): Promise<Invoice> {
  return insertDraft(await db(), draft, { idempotencyKey, isDemo });
}

export async function getInvoice(id: string): Promise<Invoice> {
  const doc = await (await db()).invoices.findOne({ _id: id });
  if (!doc) throw notFound("Invoice");
  return toInvoice(doc);
}

export async function listInvoices(options: { status?: InvoiceStatus; cursor?: string; limit: number }) {
  return findInvoicePage(await db(), options);
}

async function explainRejectedWrite(c: Collections, id: string): Promise<never> {
  const current = await c.invoices.findOne({ _id: id }, { projection: { status: 1 } });
  if (!current) throw notFound("Invoice");
  if (current.status !== "DRAFT") throw conflict("INVOICE_NOT_EDITABLE", `This invoice is ${current.status.toLowerCase()} and can no longer be edited.`);
  throw conflict("VERSION_CONFLICT", "This draft was changed elsewhere. Reload it to continue.");
}

export async function saveDraft(id: string, version: number, draft: DraftInput): Promise<{ invoice: Invoice; issues: Issue[] }> {
  const c = await db();
  const computed = await computeDraft(c, draft);
  const doc = await c.invoices.findOneAndUpdate(
    { _id: id, status: "DRAFT", version },
    { $set: { ...draftFields(draft, computed), updatedAt: new Date() }, $inc: { version: 1 } },
    { returnDocument: "after" },
  );
  if (!doc) return explainRejectedWrite(c, id);
  return { invoice: toInvoice(doc), issues: computed.issues };
}

export async function deleteDraft(id: string): Promise<void> {
  const c = await db();
  const result = await c.invoices.deleteOne({ _id: id, status: "DRAFT" });
  if (result.deletedCount === 0) await explainRejectedWrite(c, id);
}

// The counter holds the lowest number the next invoice may take; one atomic $inc both reserves the number and,
// in RANDOM_GAP mode, skips 1–8 numbers so the series keeps rising without revealing how many invoices exist.
async function reserveSequence(c: Collections, id: string, token: string, mode: NumberingMode): Promise<number> {
  const step = mode === "RANDOM_GAP" ? randomInt(MIN_GAP, MAX_GAP + 1) : 1;
  const counter = await c.counters.findOneAndUpdate({ _id: "invoice" }, { $inc: { next: step } }, { upsert: true, returnDocument: "after" });
  const sequence = counter!.next - 1;
  const stored = await c.invoices.updateOne({ _id: id, "lock.token": token }, { $set: { reservedSequence: sequence } });
  if (stored.matchedCount === 0) {
    logger.warn("Invoice number skipped after lost finalize lock", { invoiceId: id, sequence });
    throw conflict("FINALIZATION_IN_PROGRESS", "Finalization was taken over by another request.");
  }
  return sequence;
}

async function waitForFinalization(c: Collections, id: string): Promise<InvoiceDoc | null> {
  const deadline = Date.now() + IN_PROGRESS_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, IN_PROGRESS_POLL_MS));
    const doc = await c.invoices.findOne({ _id: id });
    if (!doc || doc.status !== "FINALIZING") return doc;
  }
  return null;
}

// Lock (DRAFT→FINALIZING) → reserve number → upsert customer/vehicle → commit. Works without replica-set transactions;
// a number is skipped only if a process dies between reserving and storing it.
export async function finalizeInvoice(id: string): Promise<{ invoice: Invoice; alreadyFinalized: boolean }> {
  const c = await db();
  for (let attempt = 0; attempt < 3; attempt++) {
    let doc = await c.invoices.findOne({ _id: id });
    if (!doc) throw notFound("Invoice");

    const now = new Date();
    if (doc.status === "FINALIZING" && doc.lock && now.getTime() - doc.lock.at.getTime() < STALE_LOCK_MS) {
      doc = await waitForFinalization(c, id);
      if (!doc) throw conflict("FINALIZATION_IN_PROGRESS", "This invoice is being finalized. Try again in a moment.");
    }
    if (doc.status === "FINALIZED" || doc.status === "VOID") return { invoice: toInvoice(doc), alreadyFinalized: true };

    const draft = draftFromDoc(doc);
    const [settings, lookup] = await Promise.all([readSettings(c), loadCatalogLookup(draft.lines.map((line) => line.catalogItemId))]);
    const computed = computeInvoice(draft, lookup, { shopSuppliesInParts: settings.shopSuppliesInParts });
    const errors = computed.issues.filter((issue) => issue.severity === "error");
    if (hasErrors(errors)) throw validationFailed("The invoice has problems that must be fixed before finalizing.", errors);

    const token = crypto.randomUUID();
    const locked = await c.invoices.findOneAndUpdate(
      { _id: id, version: doc.version, status: doc.status, ...(doc.lock ? { "lock.token": doc.lock.token } : { lock: null }) },
      { $set: { status: "FINALIZING", lock: { token, at: now } } },
      { returnDocument: "after" },
    );
    if (!locked) continue;

    try {
      const sequence = locked.reservedSequence ?? (await reserveSequence(c, id, token, settings.numberingMode));
      const invoiceNumber = formatInvoiceNumber(sequence, settings.invoiceNumberPrefix, settings.invoiceNumberPad);
      const customerId = await upsertCustomer(c, draft.customerId, draft.customer, now);
      const vehicleId = await upsertVehicle(c, draft.vehicleId, draft.vehicle, customerId, now);
      const at = now.toISOString();
      const events: InvoiceEvent[] = [
        ...computed.lines
          .filter((line) => line.catalogUnitPriceCents !== null && line.unitPriceCents !== line.catalogUnitPriceCents)
          .map((line) => ({
            type: "PRICE_OVERRIDE" as const,
            at,
            details: {
              lineId: line.id,
              catalogItemId: line.catalogItemId,
              catalogPrice: formatCents(line.catalogUnitPriceCents!),
              usedPrice: formatCents(line.unitPriceCents),
              reason: line.priceOverrideReason,
            },
          })),
        { type: "FINALIZED", at, details: { invoiceNumber, totalCents: computed.totals.totalCents } },
      ];

      const finalized = await c.invoices.findOneAndUpdate(
        { _id: id, status: "FINALIZING", "lock.token": token },
        {
          $set: {
            status: "FINALIZED",
            sequenceNumber: sequence,
            invoiceNumber,
            customerId,
            vehicleId,
            lines: computed.lines,
            totals: computed.totals,
            shopSuppliesInParts: settings.shopSuppliesInParts,
            business: toBusinessSnapshot(settings),
            finalizedAt: now,
            updatedAt: now,
            lock: null,
            reservedSequence: null,
          },
          $inc: { version: 1 },
          $push: { events: { $each: events } },
        },
        { returnDocument: "after" },
      );
      if (!finalized) throw conflict("FINALIZATION_IN_PROGRESS", "Finalization was taken over by another request.");
      logger.info("Invoice finalized", { invoiceId: id, invoiceNumber });
      return { invoice: toInvoice(finalized), alreadyFinalized: false };
    } catch (error) {
      await c.invoices.updateOne({ _id: id, status: "FINALIZING", "lock.token": token }, { $set: { status: "DRAFT", lock: null } });
      throw error;
    }
  }
  throw conflict("VERSION_CONFLICT", "The draft changed while finalizing. Review it and try again.");
}

export async function voidInvoice(id: string, reason: string): Promise<Invoice> {
  const c = await db();
  const now = new Date();
  const doc = await c.invoices.findOneAndUpdate(
    { _id: id, status: "FINALIZED" },
    {
      $set: { status: "VOID", voidReason: reason, voidedAt: now, updatedAt: now },
      $inc: { version: 1 },
      $push: { events: { type: "VOIDED", at: now.toISOString(), details: { reason } } },
    },
    { returnDocument: "after" },
  );
  if (doc) return toInvoice(doc);
  const current = await c.invoices.findOne({ _id: id });
  if (!current) throw notFound("Invoice");
  if (current.status === "VOID") return toInvoice(current);
  throw conflict("INVOICE_NOT_EDITABLE", "Only finalized invoices can be voided. Delete the draft instead.");
}

export async function reissueInvoice(id: string): Promise<Invoice> {
  const c = await db();
  const source = await c.invoices.findOne({ _id: id });
  if (!source) throw notFound("Invoice");
  if (source.status !== "VOID") throw conflict("INVOICE_NOT_EDITABLE", "Void the invoice before reissuing it.");
  const draft = draftFromDoc(source);
  draft.lines = draft.lines.map((line) => ({ ...line, id: crypto.randomUUID() }));
  draft.payments = draft.payments.map((payment) => ({ ...payment, id: crypto.randomUUID() }));
  return insertDraft(c, draft, {
    idempotencyKey: `reissue:${id}`,
    revisionOfId: id,
    isDemo: source.isDemo,
    events: [{ type: "REISSUED_FROM", at: new Date().toISOString(), details: { invoiceId: id, invoiceNumber: source.invoiceNumber } }],
  });
}

export async function recordPayment(id: string, version: number, payment: Payment): Promise<Invoice> {
  const c = await db();
  const doc = await c.invoices.findOne({ _id: id });
  if (!doc) throw notFound("Invoice");
  if (doc.payments.some((existing) => existing.id === payment.id)) return toInvoice(doc);
  if (doc.status !== "FINALIZED") {
    throw conflict("INVOICE_NOT_EDITABLE", "Payments on drafts are edited in the draft; void invoices cannot take payments.");
  }
  if (doc.version !== version) throw conflict("VERSION_CONFLICT", "This invoice changed elsewhere. Reload it to continue.");
  const paymentsCents = doc.totals.paymentsCents + payment.amountCents;
  if (paymentsCents > doc.totals.totalCents) {
    throw validationFailed("Payment exceeds the remaining balance.", [
      { severity: "error", path: "payment.amountCents", message: `Remaining balance is ${formatCents(doc.totals.balanceCents)}.` },
    ]);
  }
  const now = new Date();
  const updated = await c.invoices.findOneAndUpdate(
    { _id: id, status: "FINALIZED", version },
    {
      $push: {
        payments: payment,
        events: { type: "PAYMENT_RECORDED", at: now.toISOString(), details: { paymentId: payment.id, amountCents: payment.amountCents } },
      },
      $set: { "totals.paymentsCents": paymentsCents, "totals.balanceCents": doc.totals.totalCents - paymentsCents, updatedAt: now },
      $inc: { version: 1 },
    },
    { returnDocument: "after" },
  );
  if (!updated) throw conflict("VERSION_CONFLICT", "This invoice changed elsewhere. Reload it to continue.");
  return toInvoice(updated);
}


// Corrects a payment entered by mistake; the removal is kept in the invoice history.
export async function removePayment(id: string, version: number, paymentId: string): Promise<Invoice> {
  const c = await db();
  const doc = await c.invoices.findOne({ _id: id });
  if (!doc) throw notFound("Invoice");
  const payment = doc.payments.find((existing) => existing.id === paymentId);
  if (!payment) return toInvoice(doc);
  if (doc.status !== "FINALIZED") {
    throw conflict("INVOICE_NOT_EDITABLE", "Payments on drafts are edited in the draft; void invoices cannot be changed.");
  }
  if (doc.version !== version) throw conflict("VERSION_CONFLICT", "This invoice changed elsewhere. Reload it to continue.");
  const paymentsCents = doc.totals.paymentsCents - payment.amountCents;
  const now = new Date();
  const updated = await c.invoices.findOneAndUpdate(
    { _id: id, status: "FINALIZED", version },
    {
      $pull: { payments: { id: paymentId } },
      $push: {
        events: {
          type: "PAYMENT_REMOVED",
          at: now.toISOString(),
          details: { paymentId, amountCents: payment.amountCents, method: payment.method, receivedAt: payment.receivedAt },
        },
      },
      $set: { "totals.paymentsCents": paymentsCents, "totals.balanceCents": doc.totals.totalCents - paymentsCents, updatedAt: now },
      $inc: { version: 1 },
    },
    { returnDocument: "after" },
  );
  if (!updated) throw conflict("VERSION_CONFLICT", "This invoice changed elsewhere. Reload it to continue.");
  return toInvoice(updated);
}

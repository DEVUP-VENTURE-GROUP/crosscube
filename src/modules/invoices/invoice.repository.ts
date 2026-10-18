import type { Filter } from "mongodb";
import type { Collections, InvoiceDoc } from "@/lib/db/collections";
import type { Invoice, InvoiceStatus, InvoiceSummary } from "./invoice.types";
import { vehicleLabel } from "./invoice.types";
import type { DraftInput } from "./invoice.validation";

export function toInvoice(doc: InvoiceDoc): Invoice {
  const { _id, idempotencyKey: _key, lock: _lock, reservedSequence: _reserved, createdAt, updatedAt, finalizedAt, voidedAt, ...rest } = doc;
  return {
    id: _id,
    ...rest,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    finalizedAt: finalizedAt?.toISOString() ?? null,
    voidedAt: voidedAt?.toISOString() ?? null,
  };
}

export function toSummary(doc: InvoiceDoc): InvoiceSummary {
  return {
    id: doc._id,
    status: doc.status,
    invoiceNumber: doc.invoiceNumber,
    isDemo: doc.isDemo,
    customerName: doc.customer.name,
    vehicleLabel: vehicleLabel(doc.vehicle),
    totalCents: doc.totals.totalCents,
    balanceCents: doc.totals.balanceCents,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    finalizedAt: doc.finalizedAt?.toISOString() ?? null,
  };
}

export function draftFromDoc(doc: InvoiceDoc): DraftInput {
  return {
    customerId: doc.customerId,
    vehicleId: doc.vehicleId,
    customer: doc.customer,
    vehicle: doc.vehicle,
    estimateNumber: doc.estimateNumber,
    originalEstimateCents: doc.originalEstimateCents ?? null,
    serviceDate: doc.serviceDate,
    notes: doc.notes,
    lines: doc.lines.map(({ id, catalogItemId, kind, description, notes, quantityMilli, unitPriceCents, priceOverrideReason }) => ({
      id,
      catalogItemId: catalogItemId ?? "",
      kind,
      description,
      notes,
      quantityMilli,
      unitPriceCents,
      priceOverrideReason,
    })),
    payments: doc.payments,
  };
}

interface Cursor {
  createdAt: string;
  id: string;
}

export function encodeCursor(doc: InvoiceDoc): string {
  return Buffer.from(JSON.stringify({ createdAt: doc.createdAt.toISOString(), id: doc._id } satisfies Cursor)).toString("base64url");
}

function decodeCursor(cursor: string): Cursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<Cursor>;
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string" || Number.isNaN(Date.parse(parsed.createdAt))) return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

export async function findInvoicePage(
  c: Collections,
  options: { status?: InvoiceStatus; cursor?: string; limit: number },
): Promise<{ items: InvoiceSummary[]; nextCursor: string | null }> {
  const filter: Filter<InvoiceDoc> = {};
  if (options.status) filter.status = options.status;
  const cursor = options.cursor ? decodeCursor(options.cursor) : null;
  if (cursor) {
    const createdAt = new Date(cursor.createdAt);
    filter.$or = [{ createdAt: { $lt: createdAt } }, { createdAt, _id: { $lt: cursor.id } }];
  }
  const docs = await c.invoices
    .find(filter, { projection: { lines: 0, events: 0, business: 0 } })
    .sort({ createdAt: -1, _id: -1 })
    .limit(options.limit + 1)
    .toArray();
  const page = docs.slice(0, options.limit);
  return { items: page.map(toSummary), nextCursor: docs.length > options.limit ? encodeCursor(page[page.length - 1]!) : null };
}

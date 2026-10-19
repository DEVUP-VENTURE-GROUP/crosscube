import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import { updateCatalogItem } from "@/modules/catalog/catalog.service";
import { DEMO_CATALOG, DEMO_IDS, demoDraft } from "@/modules/demo/demo-data";
import {
  createDraft,
  deleteDraft,
  finalizeInvoice,
  getInvoice,
  listInvoices,
  recordPayment,
  reissueInvoice,
  saveDraft,
  voidInvoice,
} from "@/modules/invoices/invoice.service";
import { updateSettings, getSettings } from "@/modules/settings/settings.service";
import { DEMO_SETTINGS } from "@/modules/demo/demo-data";
import { useTestDatabase } from "./helpers";

const { c } = useTestDatabase();

const key = () => `test-${crypto.randomUUID()}`;
const referenceDraft = () => ({
  ...demoDraft(),
  payments: [{ id: crypto.randomUUID(), method: "CARD" as const, amountCents: 27_278, receivedAt: "2026-03-12", reference: "" }],
});

async function expectAppError(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
  return error as AppError;
}

async function counterNext() {
  return (await c().counters.findOne({ _id: "invoice" }))!.next;
}

describe("draft creation", () => {
  it("is idempotent per key, including under concurrent requests", async () => {
    const idempotencyKey = key();
    const results = await Promise.all(Array.from({ length: 8 }, () => createDraft(idempotencyKey)));
    expect(new Set(results.map((invoice) => invoice.id)).size).toBe(1);
    expect(await c().invoices.countDocuments({ idempotencyKey })).toBe(1);
  });

  it("computes totals on the server when saving and recovers the saved draft", async () => {
    const draft = await createDraft(key());
    const { invoice, issues } = await saveDraft(draft.id, draft.version, referenceDraft());
    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(invoice.version).toBe(2);
    expect(invoice.totals).toMatchObject({ subtotalCents: 26_205, taxCents: 1073, totalCents: 27_278, balanceCents: 0 });
    const recovered = await getInvoice(draft.id);
    expect(recovered.lines.map((line) => line.lineTotalCents)).toEqual([9360, 2305, 1750, 11_040, 1750]);
    expect(recovered.customer.name).toBe("Demo Customer");
  });

  it("rejects stale versions so concurrent tabs cannot overwrite each other", async () => {
    const draft = await createDraft(key());
    await saveDraft(draft.id, 1, referenceDraft());
    await expectAppError(saveDraft(draft.id, 1, demoDraft()), "VERSION_CONFLICT");
  });

  it("deletes drafts", async () => {
    const draft = await createDraft(key());
    await deleteDraft(draft.id);
    await expectAppError(getInvoice(draft.id), "NOT_FOUND");
  });
});

describe("finalization", () => {
  it("assigns a server number, snapshots pricing and business details, and stores customer and vehicle", async () => {
    const draft = await createDraft(key(), referenceDraft());
    const before = await counterNext();
    const { invoice, alreadyFinalized } = await finalizeInvoice(draft.id);
    expect(alreadyFinalized).toBe(false);
    expect(invoice.status).toBe("FINALIZED");
    expect(invoice.sequenceNumber).toBe(before);
    expect(invoice.invoiceNumber).toBe(String(before).padStart(5, "0"));
    expect(invoice.totals.totalCents).toBe(27_278);
    expect(invoice.business?.businessName).toBe(DEMO_SETTINGS.businessName);
    expect(invoice.finalizedAt).not.toBeNull();
    expect(invoice.events.map((event) => event.type)).toEqual(["CREATED", "FINALIZED"]);
    expect(await c().customers.findOne({ _id: invoice.customerId! })).toMatchObject({ name: "Demo Customer", phoneDigits: "5550101234" });
    expect(await c().vehicles.findOne({ _id: invoice.vehicleId! })).toMatchObject({ make: "Volkswagen", customerId: invoice.customerId });
  });

  it("is idempotent: repeated finalize returns the same invoice number", async () => {
    const draft = await createDraft(key(), referenceDraft());
    const first = await finalizeInvoice(draft.id);
    const second = await finalizeInvoice(draft.id);
    expect(second.alreadyFinalized).toBe(true);
    expect(second.invoice.invoiceNumber).toBe(first.invoice.invoiceNumber);
  });

  it("handles a double-click storm on one draft with exactly one number", async () => {
    const draft = await createDraft(key(), referenceDraft());
    const before = await counterNext();
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => finalizeInvoice(draft.id)));
    const fulfilled = results.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof finalizeInvoice>>> => r.status === "fulfilled");
    expect(fulfilled.length).toBe(10);
    expect(new Set(fulfilled.map((r) => r.value.invoice.invoiceNumber)).size).toBe(1);
    expect(fulfilled.filter((r) => !r.value.alreadyFinalized)).toHaveLength(1);
    expect(await counterNext()).toBe(before + 1);
  });

  it("gives concurrent finalizations of different drafts unique, gap-free numbers", async () => {
    const drafts = await Promise.all(Array.from({ length: 20 }, () => createDraft(key(), referenceDraft())));
    const before = await counterNext();
    const results = await Promise.all(drafts.map((draft) => finalizeInvoice(draft.id)));
    const numbers = results.map((r) => r.invoice.sequenceNumber!).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 20 }, (_, i) => before + i));
    expect(new Set(results.map((r) => r.invoice.invoiceNumber)).size).toBe(20);
  });

  it("refuses to finalize invalid drafts and consumes no number", async () => {
    const draft = await createDraft(key(), { ...demoDraft(), customer: { ...demoDraft().customer, name: "" } });
    const before = await counterNext();
    const error = await expectAppError(finalizeInvoice(draft.id), "VALIDATION_FAILED");
    expect(error.issues).toContainEqual(expect.objectContaining({ path: "customer.name" }));
    expect((await getInvoice(draft.id)).status).toBe("DRAFT");
    expect(await counterNext()).toBe(before);
  });

  it("keeps finalized invoices immutable", async () => {
    const draft = await createDraft(key(), referenceDraft());
    const { invoice } = await finalizeInvoice(draft.id);
    await expectAppError(saveDraft(invoice.id, invoice.version, demoDraft()), "INVOICE_NOT_EDITABLE");
    await expectAppError(deleteDraft(invoice.id), "INVOICE_NOT_EDITABLE");
  });

  it("retains original prices after the catalog price changes", async () => {
    const draft = await createDraft(key(), referenceDraft());
    const { invoice } = await finalizeInvoice(draft.id);
    const { id, ...oil } = DEMO_CATALOG.find((item) => item.id === DEMO_IDS.motorOil)!;
    await updateCatalogItem(id, { ...oil, unitPriceCents: 1_999 });
    try {
      const reloaded = await getInvoice(invoice.id);
      expect(reloaded.lines[0]).toMatchObject({ unitPriceCents: 1560, lineTotalCents: 9360 });
      expect(reloaded.totals.totalCents).toBe(27_278);

      const stale = await createDraft(key(), referenceDraft());
      const error = await expectAppError(finalizeInvoice(stale.id), "VALIDATION_FAILED");
      expect(error.issues?.[0]?.message).toContain("$19.99");
    } finally {
      await updateCatalogItem(id, oil);
    }
  });

  it("records price overrides in the audit trail", async () => {
    const draft = referenceDraft();
    draft.payments = [];
    const labor = draft.lines.find((line) => line.catalogItemId === DEMO_IDS.oilChangeLabor)!;
    labor.unitPriceCents = 9_900;
    labor.priceOverrideReason = "Returning customer courtesy";
    const created = await createDraft(key(), draft);
    const { invoice } = await finalizeInvoice(created.id);
    expect(invoice.events.find((event) => event.type === "PRICE_OVERRIDE")?.details).toMatchObject({
      catalogPrice: "$110.40",
      usedPrice: "$99.00",
      reason: "Returning customer courtesy",
    });
  });

  it("takes over a stale lock and reuses the already reserved number", async () => {
    const draft = await createDraft(key(), referenceDraft());
    const before = await counterNext();
    await c().invoices.updateOne(
      { _id: draft.id },
      { $set: { status: "FINALIZING", lock: { token: "crashed", at: new Date(Date.now() - 120_000) }, reservedSequence: 777_777 } },
    );
    const { invoice } = await finalizeInvoice(draft.id);
    expect(invoice.sequenceNumber).toBe(777_777);
    expect(await counterNext()).toBe(before);
  });

  it("reports an in-progress finalization held by a fresh lock", async () => {
    const draft = await createDraft(key(), referenceDraft());
    await c().invoices.updateOne({ _id: draft.id }, { $set: { status: "FINALIZING", lock: { token: "busy", at: new Date() } } });
    await expectAppError(finalizeInvoice(draft.id), "FINALIZATION_IN_PROGRESS");
    await expectAppError(saveDraft(draft.id, draft.version, demoDraft()), "INVOICE_NOT_EDITABLE");
  }, 20_000);

  it("enforces unique invoice numbers in the database", async () => {
    const draft = await createDraft(key(), referenceDraft());
    const { invoice } = await finalizeInvoice(draft.id);
    const other = await createDraft(key(), referenceDraft());
    await expect(c().invoices.updateOne({ _id: other.id }, { $set: { invoiceNumber: invoice.invoiceNumber } })).rejects.toThrow(/duplicate key/);
  });
});

describe("after finalization", () => {
  it("records payments up to the balance", async () => {
    const draft = await createDraft(key(), { ...referenceDraft(), payments: [] });
    const { invoice } = await finalizeInvoice(draft.id);
    expect(invoice.totals.balanceCents).toBe(27_278);
    const payment = { id: crypto.randomUUID(), method: "CASH" as const, amountCents: 20_000, receivedAt: "2026-03-13", reference: "" };
    const paid = await recordPayment(invoice.id, invoice.version, payment);
    expect(paid.totals).toMatchObject({ paymentsCents: 20_000, balanceCents: 7_278, totalCents: 27_278 });
    expect(await recordPayment(invoice.id, paid.version, payment)).toMatchObject({ version: paid.version });
    await expectAppError(
      recordPayment(invoice.id, paid.version, { ...payment, id: crypto.randomUUID(), amountCents: 7_279 }),
      "VALIDATION_FAILED",
    );
  });

  it("voids and reissues as a linked draft exactly once", async () => {
    const draft = await createDraft(key(), referenceDraft());
    const { invoice } = await finalizeInvoice(draft.id);
    await expectAppError(reissueInvoice(invoice.id), "INVOICE_NOT_EDITABLE");
    const voided = await voidInvoice(invoice.id, "Wrong vehicle selected");
    expect(voided).toMatchObject({ status: "VOID", voidReason: "Wrong vehicle selected", invoiceNumber: invoice.invoiceNumber });
    const [a, b] = await Promise.all([reissueInvoice(invoice.id), reissueInvoice(invoice.id)]);
    expect(a.id).toBe(b.id);
    expect(a).toMatchObject({ status: "DRAFT", revisionOfId: invoice.id, invoiceNumber: null });
    expect(a.lines).toHaveLength(invoice.lines.length);
    expect(a.lines[0]!.id).not.toBe(invoice.lines[0]!.id);
  });

  it("lists invoices with cursor pagination", async () => {
    const first = await listInvoices({ limit: 5 });
    expect(first.items).toHaveLength(5);
    expect(first.nextCursor).not.toBeNull();
    const second = await listInvoices({ limit: 5, cursor: first.nextCursor! });
    const ids = new Set([...first.items, ...second.items].map((item) => item.id));
    expect(ids.size).toBe(first.items.length + second.items.length);
    const finalized = await listInvoices({ limit: 100, status: "FINALIZED" });
    expect(finalized.items.every((item) => item.status === "FINALIZED")).toBe(true);
  });
});

describe("settings and numbering", () => {
  it("issues unique, rising numbers with random gaps of 2-9 when configured", async () => {
    const { nextInvoiceNumber, updatedAt: _u, ...input } = await getSettings();
    const start = nextInvoiceNumber + 22_000;
    await updateSettings({ ...input, numberingMode: "RANDOM_GAP" }, start);
    try {
      const drafts = await Promise.all(Array.from({ length: 20 }, () => createDraft(key(), referenceDraft())));
      const numbers = (await Promise.all(drafts.map((draft) => finalizeInvoice(draft.id)))).map((r) => r.invoice.sequenceNumber!).sort((a, b) => a - b);
      expect(new Set(numbers).size).toBe(20);
      expect(numbers[0]).toBeGreaterThanOrEqual(start + 1);
      expect(numbers[0]).toBeLessThanOrEqual(start + 8);
      for (let i = 1; i < numbers.length; i++) {
        const gap = numbers[i]! - numbers[i - 1]!;
        expect(gap).toBeGreaterThanOrEqual(2);
        expect(gap).toBeLessThanOrEqual(9);
      }
      expect(new Set(numbers.slice(1).map((n, i) => n - numbers[i]!)).size).toBeGreaterThan(1);
    } finally {
      await updateSettings({ ...input, numberingMode: "SEQUENTIAL" }, undefined);
    }
  });

  it("allows raising but never lowering the next invoice number", async () => {
    const settings = await getSettings();
    const { nextInvoiceNumber, updatedAt: _u, ...input } = settings;
    await expectAppError(updateSettings(input, nextInvoiceNumber - 1), "VALIDATION_FAILED");
    await updateSettings({ ...input, invoiceNumberPrefix: "INV-" }, nextInvoiceNumber + 1000);
    const draft = await createDraft(key(), referenceDraft());
    const { invoice } = await finalizeInvoice(draft.id);
    expect(invoice.invoiceNumber).toBe(`INV-${String(nextInvoiceNumber + 1000).padStart(5, "0")}`);
    await updateSettings(input, undefined);
  });
});

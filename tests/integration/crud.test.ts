import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import {
  createCatalogItem,
  createTaxCategory,
  deleteCatalogItem,
  deleteTaxCategory,
  listTaxCategories,
  updateCatalogItem,
} from "@/modules/catalog/catalog.service";
import {
  createCustomer,
  createVehicle,
  deleteCustomer,
  deleteVehicle,
  getCustomer,
  listCustomers,
  updateCustomer,
  updateVehicle,
} from "@/modules/customers/customer.service";
import { DEMO_CATALOG, DEMO_IDS, demoDraft } from "@/modules/demo/demo-data";
import { createDraft, finalizeInvoice, getInvoice, recordPayment, removePayment, saveDraft } from "@/modules/invoices/invoice.service";
import { EMPTY_CUSTOMER, EMPTY_VEHICLE } from "@/modules/invoices/invoice.types";
import { useTestDatabase } from "./helpers";

const { c } = useTestDatabase();

async function expectCode(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
}

const part = { ...DEMO_CATALOG.find((item) => item.id === DEMO_IDS.oilFilterKit)!, id: undefined };

describe("catalog items", () => {
  it("clears the demo badge when edited", async () => {
    const { id, ...hazmat } = DEMO_CATALOG.find((item) => item.id === DEMO_IDS.hazmat)!;
    const updated = await updateCatalogItem(id, { ...hazmat, unitPriceCents: 1_800 });
    expect(updated.isDemo).toBe(false);
    await updateCatalogItem(id, hazmat);
  });

  it("deletes an item and removes it as a suggested labor operation", async () => {
    const { id: _ignored, ...input } = part;
    const labor = await createCatalogItem({ ...input, kind: "LABOR", name: "Temp labor", sku: null, associatedLaborId: null, taxCategoryId: null });
    const withLabor = await createCatalogItem({ ...input, name: "Temp part", sku: "TMP-1", associatedLaborId: labor.id });
    await deleteCatalogItem(labor.id);
    expect(await c().catalogItems.findOne({ _id: labor.id })).toBeNull();
    expect((await c().catalogItems.findOne({ _id: withLabor.id }))?.associatedLaborId).toBeNull();
    await deleteCatalogItem(withLabor.id);
    await expectCode(deleteCatalogItem(withLabor.id), "NOT_FOUND");
  });

  it("keeps finalized invoices intact when a used item is deleted", async () => {
    const { id: _ignored, ...input } = part;
    const temp = await createCatalogItem({ ...input, name: "Disposable part", sku: "TMP-2" });
    const draft = demoDraft();
    draft.lines = [{ id: "tmp-line", catalogItemId: temp.id, kind: "PART", description: "Disposable part", notes: "", quantityMilli: 2000, unitPriceCents: temp.unitPriceCents, priceOverrideReason: "" }];
    const { invoice } = await finalizeInvoice((await createDraft(crypto.randomUUID(), draft)).id);
    await deleteCatalogItem(temp.id);
    const reloaded = await getInvoice(invoice.id);
    expect(reloaded.lines[0]).toMatchObject({ description: "Disposable part", lineTotalCents: temp.unitPriceCents * 2 });
  });
});

describe("tax categories", () => {
  it("refuses to delete a category in use and deletes an unused one", async () => {
    const used = (await listTaxCategories()).find((category) => category.code === "PARTS")!;
    await expectCode(deleteTaxCategory(used.id), "DUPLICATE");
    const unused = await createTaxCategory({ code: "TEMP_TAX", name: "Temp", ratePpm: 10_000, active: true });
    await deleteTaxCategory(unused.id);
    expect((await listTaxCategories()).some((category) => category.id === unused.id)).toBe(false);
  });
});

describe("payments on finalized invoices", () => {
  it("removes a payment, restores the balance and records the removal", async () => {
    const draft = { ...demoDraft(), payments: [] };
    const { invoice } = await finalizeInvoice((await createDraft(crypto.randomUUID(), draft)).id);
    const payment = { id: crypto.randomUUID(), method: "CASH" as const, amountCents: 10_000, receivedAt: "2026-10-19", reference: "" };
    const paid = await recordPayment(invoice.id, invoice.version, payment);
    expect(paid.totals.balanceCents).toBe(17_278);
    await expectCode(removePayment(invoice.id, invoice.version, payment.id), "VERSION_CONFLICT");
    const removed = await removePayment(invoice.id, paid.version, payment.id);
    expect(removed.payments).toEqual([]);
    expect(removed.totals).toMatchObject({ paymentsCents: 0, balanceCents: 27_278, totalCents: 27_278 });
    expect(removed.events.at(-1)).toMatchObject({ type: "PAYMENT_REMOVED", details: { amountCents: 10_000 } });
    expect((await removePayment(invoice.id, removed.version, payment.id)).version).toBe(removed.version);
  });

  it("does not remove payments from drafts through this path", async () => {
    const draft = await createDraft(crypto.randomUUID(), demoDraft());
    const saved = await saveDraft(draft.id, draft.version, {
      ...demoDraft(),
      payments: [{ id: "draft-pay", method: "CARD", amountCents: 100, receivedAt: "2026-10-19", reference: "" }],
    });
    await expectCode(removePayment(draft.id, saved.invoice.version, "draft-pay"), "INVOICE_NOT_EDITABLE");
  });
});

describe("customers and vehicles", () => {
  it("creates, lists, edits and deletes customers and their vehicles", async () => {
    const customer = await createCustomer({ ...EMPTY_CUSTOMER, name: "Morgan Lane", phone: "(555) 444-1212", customerNumber: "9001" });
    expect(customer).toMatchObject({ name: "Morgan Lane", vehicles: [] });
    expect((await listCustomers("")).some((item) => item.id === customer.id)).toBe(true);
    expect((await listCustomers("4441212")).map((item) => item.id)).toContain(customer.id);

    const updated = await updateCustomer(customer.id, { ...EMPTY_CUSTOMER, name: "Morgan Lane-Smith", phone: "555-444-1212" });
    expect(updated.name).toBe("Morgan Lane-Smith");

    const vehicle = await createVehicle(customer.id, { ...EMPTY_VEHICLE, year: 2021, make: "Ford", model: "F-150", vin: "1FTFW1E50MFA00001" });
    const edited = await updateVehicle(vehicle.id, { ...EMPTY_VEHICLE, year: 2021, make: "Ford", model: "F-150 XLT", odometer: 41_000 });
    expect(edited).toMatchObject({ model: "F-150 XLT", odometer: 41_000 });
    expect((await getCustomer(customer.id)).vehicles).toHaveLength(1);

    const second = await createVehicle(customer.id, { ...EMPTY_VEHICLE, make: "Honda", model: "Civic" });
    await deleteVehicle(second.id);
    expect((await getCustomer(customer.id)).vehicles.map((v) => v.id)).toEqual([vehicle.id]);

    await deleteCustomer(customer.id);
    await expectCode(getCustomer(customer.id), "NOT_FOUND");
    expect(await c().vehicles.countDocuments({ customerId: customer.id })).toBe(0);
    await expectCode(createVehicle(customer.id, EMPTY_VEHICLE), "NOT_FOUND");
  });

  it("keeps issued invoices unchanged when the customer record is edited or deleted", async () => {
    const draft = demoDraft();
    draft.customer = { ...draft.customer, name: "Riley Shop", phone: "(555) 909-0000" };
    const { invoice } = await finalizeInvoice((await createDraft(crypto.randomUUID(), draft)).id);
    await updateCustomer(invoice.customerId!, { ...EMPTY_CUSTOMER, name: "Renamed Person", phone: "555-909-0000" });
    expect((await getInvoice(invoice.id)).customer.name).toBe("Riley Shop");
    await deleteCustomer(invoice.customerId!);
    expect((await getInvoice(invoice.id)).customer.name).toBe("Riley Shop");
  });
});

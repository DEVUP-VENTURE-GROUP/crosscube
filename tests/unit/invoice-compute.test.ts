import { describe, expect, it } from "vitest";
import { DEMO_IDS } from "@/modules/demo/demo-data";
import { computeInvoice, hasErrors } from "@/modules/invoices/invoice.compute";
import { draftInputSchema } from "@/modules/invoices/invoice.validation";
import { demoLookup, referenceDraft } from "./fixtures";

const options = { shopSuppliesInParts: true };

describe("computeInvoice", () => {
  it("resolves the reference draft with catalog snapshots and no errors", () => {
    const result = computeInvoice(referenceDraft(), demoLookup(), options);
    expect(hasErrors(result.issues)).toBe(false);
    expect(result.totals.totalCents).toBe(27_278);
    expect(result.totals.balanceCents).toBe(0);
    const oil = result.lines.find((line) => line.catalogItemId === DEMO_IDS.motorOil)!;
    expect(oil).toMatchObject({ kind: "PART", unit: "QT", catalogUnitPriceCents: 1560, lineTotalCents: 9360, tax: { code: "PARTS", ratePpm: 80_000 } });
    expect(result.lines.find((line) => line.catalogItemId === DEMO_IDS.hazmat)!.tax).toBeNull();
  });

  it("takes kind and tax from the catalog, not from the client", () => {
    const draft = referenceDraft();
    draft.lines[0] = { ...draft.lines[0]!, kind: "LABOR" };
    const result = computeInvoice(draft, demoLookup(), options);
    expect(result.lines[0]!.kind).toBe("PART");
    expect(result.totals.taxCents).toBe(1073);
  });

  it("requires customer and vehicle basics", () => {
    const draft = referenceDraft();
    draft.customer = { ...draft.customer, name: "", phone: "" };
    draft.vehicle = { ...draft.vehicle, year: null, make: "", model: "" };
    const paths = computeInvoice(draft, demoLookup(), options).issues.filter((i) => i.severity === "error").map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining(["customer.name", "customer.phone", "vehicle.year", "vehicle.make", "vehicle.model"]));
  });

  it("rejects invalid VINs and warns on check digit mismatch", () => {
    const draft = referenceDraft();
    draft.vehicle = { ...draft.vehicle, vin: "123" };
    expect(computeInvoice(draft, demoLookup(), options).issues).toContainEqual(expect.objectContaining({ path: "vehicle.vin", severity: "error" }));
    draft.vehicle = { ...draft.vehicle, vin: "1M8GDM9A1KP042788" };
    expect(computeInvoice(draft, demoLookup(), options).issues).toContainEqual(expect.objectContaining({ path: "vehicle.vin", severity: "warning" }));
  });

  it("rejects price changes on items that do not allow them", () => {
    const draft = referenceDraft();
    draft.lines[0] = { ...draft.lines[0]!, unitPriceCents: 999 };
    const issues = computeInvoice(draft, demoLookup(), options).issues;
    expect(issues).toContainEqual(expect.objectContaining({ path: "lines.0.unitPriceCents", severity: "error" }));
  });

  it("requires a reason for an authorized price change and keeps the catalog price on the line", () => {
    const draft = referenceDraft();
    const laborIndex = draft.lines.findIndex((line) => line.catalogItemId === DEMO_IDS.oilChangeLabor);
    draft.lines[laborIndex] = { ...draft.lines[laborIndex]!, unitPriceCents: 9_900 };
    draft.payments = [];
    expect(computeInvoice(draft, demoLookup(), options).issues).toContainEqual(
      expect.objectContaining({ path: `lines.${laborIndex}.priceOverrideReason` }),
    );
    draft.lines[laborIndex]!.priceOverrideReason = "Loyalty discount approved by manager";
    const result = computeInvoice(draft, demoLookup(), options);
    expect(hasErrors(result.issues)).toBe(false);
    expect(result.lines[laborIndex]).toMatchObject({ unitPriceCents: 9_900, catalogUnitPriceCents: 11_040 });
  });

  it("rejects quantity changes on fixed-quantity fees", () => {
    const draft = referenceDraft();
    const index = draft.lines.findIndex((line) => line.catalogItemId === DEMO_IDS.hazmat);
    draft.lines[index] = { ...draft.lines[index]!, quantityMilli: 2000 };
    expect(computeInvoice(draft, demoLookup(), options).issues).toContainEqual(expect.objectContaining({ path: `lines.${index}.quantityMilli` }));
  });

  it("flags inactive and deleted catalog items", () => {
    const lookup = demoLookup((items) =>
      items.filter((item) => item.id !== DEMO_IDS.hazmat).map((item) => (item.id === DEMO_IDS.oilFilterKit ? { ...item, active: false } : item)),
    );
    const messages = computeInvoice(referenceDraft(), lookup, options).issues.map((issue) => issue.message);
    expect(messages).toEqual(expect.arrayContaining([expect.stringContaining("inactive"), expect.stringContaining("no longer in the catalog")]));
  });

  it("detects a catalog price change since the line was added", () => {
    const lookup = demoLookup((items) => items.map((item) => (item.id === DEMO_IDS.oilFilterKit ? { ...item, unitPriceCents: 2_500 } : item)));
    expect(computeInvoice(referenceDraft(), lookup, options).issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining("$25.00") }),
    );
  });

  it("rejects overpayment", () => {
    const draft = referenceDraft();
    draft.payments[0]!.amountCents = 27_279;
    expect(computeInvoice(draft, demoLookup(), options).issues).toContainEqual(expect.objectContaining({ path: "payments" }));
  });

  it("requires at least one line", () => {
    const draft = { ...referenceDraft(), lines: [], payments: [] };
    expect(computeInvoice(draft, demoLookup(), options).issues).toContainEqual(expect.objectContaining({ path: "lines", severity: "error" }));
  });

  it("validates draft input at the boundary", () => {
    expect(draftInputSchema.safeParse(referenceDraft()).success).toBe(true);
    const bad = referenceDraft() as unknown as Record<string, unknown>;
    expect(draftInputSchema.safeParse({ ...bad, serviceDate: "2026-02-30" }).success).toBe(false);
    expect(draftInputSchema.safeParse({ ...bad, unexpected: true }).success).toBe(false);
    const parsed = draftInputSchema.parse({ ...bad, vehicle: { ...referenceDraft().vehicle, vin: " 1m8gdm9axkp042788 ", licensePlate: "abc123" } });
    expect(parsed.vehicle).toMatchObject({ vin: "1M8GDM9AXKP042788", licensePlate: "ABC123" });
  });
});

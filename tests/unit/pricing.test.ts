import { describe, expect, it } from "vitest";
import { calculateInvoiceTotals, calculateLineTotal, lineSection, PricingError } from "@/modules/pricing/pricing.service";
import type { PricingLine } from "@/modules/pricing/pricing.types";

const SALES_TAX = { code: "PARTS", name: "Sales Tax", ratePpm: 80_000 };

const reference: PricingLine[] = [
  { kind: "PART", quantityMilli: 6000, unitPriceCents: 1560, tax: SALES_TAX },
  { kind: "PART", quantityMilli: 1000, unitPriceCents: 2305, tax: SALES_TAX },
  { kind: "SHOP_SUPPLIES", quantityMilli: 1000, unitPriceCents: 1750, tax: SALES_TAX },
  { kind: "LABOR", quantityMilli: 1000, unitPriceCents: 11_040, tax: null },
  { kind: "HAZMAT", quantityMilli: 1000, unitPriceCents: 1750, tax: null },
];

describe("pricing service", () => {
  it("reproduces the reference invoice totals from line items", () => {
    const { lineTotalsCents, totals } = calculateInvoiceTotals(reference, [{ amountCents: 27_278 }], { shopSuppliesInParts: true });
    expect(lineTotalsCents).toEqual([9360, 2305, 1750, 11_040, 1750]);
    expect(totals.partsCents).toBe(13_415);
    expect(totals.laborCents).toBe(11_040);
    expect(totals.hazmatCents).toBe(1750);
    expect(totals.shopSuppliesCents).toBe(0);
    expect(totals.subtotalCents).toBe(26_205);
    expect(totals.taxCents).toBe(1073);
    expect(totals.totalCents).toBe(27_278);
    expect(totals.paymentsCents).toBe(27_278);
    expect(totals.balanceCents).toBe(0);
  });

  it("counts shop supplies and hazmat once each, even when equal amounts", () => {
    const { totals } = calculateInvoiceTotals(reference, [], { shopSuppliesInParts: false });
    expect(totals.partsCents).toBe(11_665);
    expect(totals.shopSuppliesCents).toBe(1750);
    expect(totals.hazmatCents).toBe(1750);
    expect(totals.subtotalCents).toBe(26_205);
    expect(totals.totalCents).toBe(27_278);
  });

  it("does not tax non-taxable lines and taxes each category once on its summed base", () => {
    const lines: PricingLine[] = [
      { kind: "PART", quantityMilli: 1000, unitPriceCents: 5, tax: SALES_TAX },
      { kind: "PART", quantityMilli: 1000, unitPriceCents: 5, tax: SALES_TAX },
      { kind: "PART", quantityMilli: 1000, unitPriceCents: 5, tax: SALES_TAX },
      { kind: "LABOR", quantityMilli: 1000, unitPriceCents: 10_000, tax: null },
    ];
    const { totals } = calculateInvoiceTotals(lines, [], { shopSuppliesInParts: true });
    expect(totals.taxLines).toEqual([{ ...SALES_TAX, taxableCents: 15, taxCents: 1 }]);
    expect(totals.taxCents).toBe(1);
  });

  it("keeps separate tax lines per category and rate", () => {
    const lines: PricingLine[] = [
      { kind: "PART", quantityMilli: 1000, unitPriceCents: 10_000, tax: SALES_TAX },
      { kind: "OTHER_FEE", quantityMilli: 1000, unitPriceCents: 1000, tax: { code: "FEE", name: "Fee Tax", ratePpm: 25_000 } },
    ];
    const { totals } = calculateInvoiceTotals(lines, [], { shopSuppliesInParts: true });
    expect(totals.taxLines.map((t) => [t.code, t.taxCents])).toEqual([
      ["FEE", 25],
      ["PARTS", 800],
    ]);
    expect(totals.otherFeesCents).toBe(1000);
    expect(totals.totalCents).toBe(11_825);
  });

  it("handles fractional labor hours", () => {
    const { totals } = calculateInvoiceTotals([{ kind: "LABOR", quantityMilli: 1300, unitPriceCents: 12_999, tax: null }], [], {
      shopSuppliesInParts: true,
    });
    expect(totals.laborCents).toBe(16_899);
  });

  it("computes partial payment balances", () => {
    const { totals } = calculateInvoiceTotals(reference, [{ amountCents: 10_000 }, { amountCents: 5_000 }], { shopSuppliesInParts: true });
    expect(totals.paymentsCents).toBe(15_000);
    expect(totals.balanceCents).toBe(12_278);
  });

  it("rejects out-of-range quantities and prices", () => {
    expect(() => calculateLineTotal(0, 100)).toThrow(PricingError);
    expect(() => calculateLineTotal(1000, -1)).toThrow(PricingError);
    expect(() => calculateLineTotal(1.5, 100)).toThrow(PricingError);
    expect(() => calculateLineTotal(9_999_999, 10_000_000)).toThrow(/Line total/);
  });

  it("returns zero totals for an empty invoice", () => {
    const { totals } = calculateInvoiceTotals([], [], { shopSuppliesInParts: true });
    expect(totals.totalCents).toBe(0);
    expect(totals.taxLines).toEqual([]);
  });

  it("places lines in document sections", () => {
    expect(lineSection("PART", { shopSuppliesInParts: false })).toBe("PARTS");
    expect(lineSection("SHOP_SUPPLIES", { shopSuppliesInParts: true })).toBe("PARTS");
    expect(lineSection("SHOP_SUPPLIES", { shopSuppliesInParts: false })).toBe("LABOR");
    expect(lineSection("HAZMAT", { shopSuppliesInParts: true })).toBe("LABOR");
    expect(lineSection("LABOR", { shopSuppliesInParts: true })).toBe("LABOR");
  });
});

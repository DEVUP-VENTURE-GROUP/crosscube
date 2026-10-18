import {
  MAX_INVOICE_TOTAL_CENTS,
  MAX_LINE_TOTAL_CENTS,
  MAX_QUANTITY_MILLI,
  MAX_UNIT_PRICE_CENTS,
  multiplyQuantity,
  type Cents,
} from "@/lib/money/money";
import { calculateTax } from "./tax.service";
import type { DocumentSection, InvoiceTotals, LineKind, PricingLine, PricingOptions } from "./pricing.types";

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingError";
  }
}

export function calculateLineTotal(quantityMilli: number, unitPriceCents: Cents): Cents {
  if (!Number.isSafeInteger(quantityMilli) || quantityMilli <= 0 || quantityMilli > MAX_QUANTITY_MILLI) {
    throw new PricingError("Quantity must be greater than 0 and at most 9,999.999.");
  }
  if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents < 0 || unitPriceCents > MAX_UNIT_PRICE_CENTS) {
    throw new PricingError("Unit price must be between $0.00 and $100,000.00.");
  }
  const total = multiplyQuantity(quantityMilli, unitPriceCents);
  if (total > MAX_LINE_TOTAL_CENTS) throw new PricingError("Line total exceeds $1,000,000.00.");
  return total;
}

export function lineSection(kind: LineKind, options: PricingOptions): DocumentSection {
  if (kind === "PART") return "PARTS";
  if (kind === "SHOP_SUPPLIES" && options.shopSuppliesInParts) return "PARTS";
  return "LABOR";
}

export interface PricedInvoice {
  lineTotalsCents: Cents[];
  totals: InvoiceTotals;
}

// Buckets are display buckets: with shopSuppliesInParts the supplies are reported inside partsCents.
export function calculateInvoiceTotals(
  lines: readonly PricingLine[],
  payments: readonly { amountCents: Cents }[],
  options: PricingOptions,
): PricedInvoice {
  const lineTotalsCents = lines.map((line) => calculateLineTotal(line.quantityMilli, line.unitPriceCents));
  const buckets = { PART: 0, LABOR: 0, SHOP_SUPPLIES: 0, HAZMAT: 0, OTHER_FEE: 0 } satisfies Record<LineKind, Cents>;
  lines.forEach((line, index) => {
    buckets[line.kind] += lineTotalsCents[index]!;
  });

  const partsCents = buckets.PART + (options.shopSuppliesInParts ? buckets.SHOP_SUPPLIES : 0);
  const shopSuppliesCents = options.shopSuppliesInParts ? 0 : buckets.SHOP_SUPPLIES;
  const subtotalCents = partsCents + buckets.LABOR + shopSuppliesCents + buckets.HAZMAT + buckets.OTHER_FEE;
  const taxLines = calculateTax(lines, lineTotalsCents);
  const taxCents = taxLines.reduce((sum, line) => sum + line.taxCents, 0);
  const totalCents = subtotalCents + taxCents;
  if (totalCents > MAX_INVOICE_TOTAL_CENTS) throw new PricingError("Invoice total exceeds $10,000,000.00.");

  const paymentsCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  return {
    lineTotalsCents,
    totals: {
      partsCents,
      laborCents: buckets.LABOR,
      shopSuppliesCents,
      hazmatCents: buckets.HAZMAT,
      otherFeesCents: buckets.OTHER_FEE,
      subtotalCents,
      taxLines,
      taxCents,
      totalCents,
      paymentsCents,
      balanceCents: totalCents - paymentsCents,
    },
  };
}

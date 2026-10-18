import type { Cents, QuantityMilli } from "@/lib/money/money";

export const LINE_KINDS = ["PART", "LABOR", "SHOP_SUPPLIES", "HAZMAT", "OTHER_FEE"] as const;
export type LineKind = (typeof LINE_KINDS)[number];

export const LINE_KIND_LABELS: Record<LineKind, string> = {
  PART: "Part",
  LABOR: "Labor",
  SHOP_SUPPLIES: "Shop supplies",
  HAZMAT: "Hazardous materials",
  OTHER_FEE: "Other charge",
};

export interface TaxSnapshot {
  code: string;
  name: string;
  ratePpm: number;
}

export interface PricingLine {
  kind: LineKind;
  quantityMilli: QuantityMilli;
  unitPriceCents: Cents;
  tax: TaxSnapshot | null;
}

export interface PricingOptions {
  shopSuppliesInParts: boolean;
}

export interface TaxLine extends TaxSnapshot {
  taxableCents: Cents;
  taxCents: Cents;
}

export interface InvoiceTotals {
  partsCents: Cents;
  laborCents: Cents;
  shopSuppliesCents: Cents;
  hazmatCents: Cents;
  otherFeesCents: Cents;
  subtotalCents: Cents;
  taxLines: TaxLine[];
  taxCents: Cents;
  totalCents: Cents;
  paymentsCents: Cents;
  balanceCents: Cents;
}

export type DocumentSection = "PARTS" | "LABOR";

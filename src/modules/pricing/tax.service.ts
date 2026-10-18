import { applyRatePpm, type Cents } from "@/lib/money/money";
import type { PricingLine, TaxLine } from "./pricing.types";

// Tax is computed once per category on the summed base, so per-line rounding never compounds.
export function calculateTax(lines: readonly PricingLine[], lineTotalsCents: readonly Cents[]): TaxLine[] {
  const groups = new Map<string, TaxLine>();
  lines.forEach((line, index) => {
    if (!line.tax || line.tax.ratePpm <= 0) return;
    const key = `${line.tax.code}|${line.tax.ratePpm}`;
    const group = groups.get(key) ?? { ...line.tax, taxableCents: 0, taxCents: 0 };
    group.taxableCents += lineTotalsCents[index]!;
    groups.set(key, group);
  });
  return [...groups.values()]
    .map((group) => ({ ...group, taxCents: applyRatePpm(group.taxableCents, group.ratePpm) }))
    .sort((a, b) => a.code.localeCompare(b.code) || a.ratePpm - b.ratePpm);
}

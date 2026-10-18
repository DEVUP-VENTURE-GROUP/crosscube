import { formatCents } from "@/lib/money/money";
import type { CatalogItem, TaxCategory } from "@/modules/catalog/catalog.types";
import { calculateInvoiceTotals, calculateLineTotal, PricingError } from "@/modules/pricing/pricing.service";
import type { InvoiceTotals, PricingOptions } from "@/modules/pricing/pricing.types";
import { checkVin } from "@/modules/vehicles/vin";
import type { InvoiceLine, Issue } from "./invoice.types";
import type { DraftInput, LineInput } from "./invoice.validation";

export interface CatalogLookup {
  items: ReadonlyMap<string, CatalogItem>;
  taxCategories: ReadonlyMap<string, TaxCategory>;
}

export interface ComputedInvoice {
  lines: InvoiceLine[];
  totals: InvoiceTotals;
  issues: Issue[];
}

function resolveLine(line: LineInput, index: number, lookup: CatalogLookup, issues: Issue[]): InvoiceLine {
  const path = `lines.${index}`;
  const item = lookup.items.get(line.catalogItemId);
  if (!item) {
    issues.push({ severity: "error", path, message: `"${line.description}" is no longer in the catalog.` });
    return { ...line, sku: "", unit: "", catalogUnitPriceCents: null, tax: null, lineTotalCents: 0 };
  }

  let tax: InvoiceLine["tax"] = null;
  if (item.taxCategoryId) {
    const category = lookup.taxCategories.get(item.taxCategoryId);
    if (!category || !category.active) {
      issues.push({ severity: "error", path, message: `Tax category for "${item.name}" is missing or inactive.` });
    } else {
      tax = { code: category.code, name: category.name, ratePpm: category.ratePpm };
    }
  }

  if (!item.active) issues.push({ severity: "error", path, message: `"${item.name}" is inactive in the catalog.` });
  if (!item.quantityEditable && line.quantityMilli !== item.defaultQuantityMilli) {
    issues.push({ severity: "error", path: `${path}.quantityMilli`, message: `Quantity of "${item.name}" cannot be changed.` });
  }
  if (line.unitPriceCents !== item.unitPriceCents) {
    if (!item.priceEditable) {
      issues.push({
        severity: "error",
        path: `${path}.unitPriceCents`,
        message: `Price of "${item.name}" must match the catalog price of ${formatCents(item.unitPriceCents)}.`,
      });
    } else if (!line.priceOverrideReason) {
      issues.push({
        severity: "error",
        path: `${path}.priceOverrideReason`,
        message: `Give a reason for changing the price of "${item.name}" from ${formatCents(item.unitPriceCents)}.`,
      });
    }
  }

  let lineTotalCents = 0;
  try {
    lineTotalCents = calculateLineTotal(line.quantityMilli, line.unitPriceCents);
  } catch (error) {
    if (!(error instanceof PricingError)) throw error;
    issues.push({ severity: "error", path, message: `"${line.description}": ${error.message}` });
  }

  return {
    id: line.id,
    catalogItemId: item.id,
    kind: item.kind,
    sku: item.sku ?? "",
    description: line.description,
    notes: line.notes,
    unit: item.unit,
    quantityMilli: line.quantityMilli,
    unitPriceCents: line.unitPriceCents,
    catalogUnitPriceCents: item.unitPriceCents,
    priceOverrideReason: line.unitPriceCents === item.unitPriceCents ? "" : line.priceOverrideReason,
    tax,
    lineTotalCents,
  };
}

function headerIssues(draft: DraftInput): Issue[] {
  const issues: Issue[] = [];
  const required = (value: unknown, path: string, label: string) => {
    if (value === null || value === "") issues.push({ severity: "error", path, message: `${label} is required.`, code: "REQUIRED" });
  };
  required(draft.customer.name, "customer.name", "Customer name");
  required(draft.customer.phone, "customer.phone", "Customer phone");
  required(draft.vehicle.year, "vehicle.year", "Vehicle year");
  required(draft.vehicle.make, "vehicle.make", "Vehicle make");
  required(draft.vehicle.model, "vehicle.model", "Vehicle model");

  const vin = checkVin(draft.vehicle.vin);
  if (vin.status === "invalid") issues.push({ severity: "error", path: "vehicle.vin", message: vin.message });
  if (vin.status === "valid" && vin.checkDigit === "mismatch") {
    issues.push({
      severity: "warning",
      path: "vehicle.vin",
      message: "VIN check digit does not match (expected for many non-North-American vehicles). Double-check the VIN.",
    });
  }
  if (draft.vehicle.odometer === null) issues.push({ severity: "warning", path: "vehicle.odometer", message: "Odometer reading is empty." });
  if (draft.lines.length === 0) {
    issues.push({ severity: "error", path: "lines", message: "Add at least one part, labor operation or fee.", code: "REQUIRED" });
  }

  const ids = new Set<string>();
  for (const [index, line] of draft.lines.entries()) {
    if (ids.has(line.id)) issues.push({ severity: "error", path: `lines.${index}`, message: "Duplicate line id." });
    ids.add(line.id);
  }
  return issues;
}

export function computeInvoice(draft: DraftInput, lookup: CatalogLookup, options: PricingOptions): ComputedInvoice {
  const issues = headerIssues(draft);
  const lines = draft.lines.map((line, index) => resolveLine(line, index, lookup, issues));
  const priced = lines.map((line) =>
    line.lineTotalCents === 0 ? { ...line, quantityMilli: 1000, unitPriceCents: 0 } : line,
  );

  let totals: InvoiceTotals;
  try {
    totals = calculateInvoiceTotals(priced, draft.payments, options).totals;
  } catch (error) {
    if (!(error instanceof PricingError)) throw error;
    issues.push({ severity: "error", path: "totals", message: error.message });
    totals = calculateInvoiceTotals([], draft.payments, options).totals;
  }

  if (totals.paymentsCents > totals.totalCents) {
    issues.push({
      severity: "error",
      path: "payments",
      message: `Payments (${formatCents(totals.paymentsCents)}) exceed the invoice total (${formatCents(totals.totalCents)}).`,
    });
  }
  return { lines, totals, issues };
}

export function hasErrors(issues: readonly Issue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}

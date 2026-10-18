import type { CatalogItem, TaxCategory } from "@/modules/catalog/catalog.types";
import { DEMO_CATALOG, DEMO_TAX_CATEGORY, demoDraft } from "@/modules/demo/demo-data";
import type { CatalogLookup } from "@/modules/invoices/invoice.compute";
import type { DraftInput } from "@/modules/invoices/invoice.validation";

const STAMP = "2026-01-01T00:00:00.000Z";

export function demoCatalogItems(): CatalogItem[] {
  return DEMO_CATALOG.map((item) => ({ ...item, isDemo: true, createdAt: STAMP, updatedAt: STAMP }));
}

export function demoTaxCategory(): TaxCategory {
  return { ...DEMO_TAX_CATEGORY, isDemo: true, createdAt: STAMP, updatedAt: STAMP };
}

export function demoLookup(overrides: (items: CatalogItem[]) => CatalogItem[] = (items) => items): CatalogLookup {
  const tax = demoTaxCategory();
  return {
    items: new Map(overrides(demoCatalogItems()).map((item) => [item.id, item])),
    taxCategories: new Map([[tax.id, tax]]),
  };
}

export function referenceDraft(): DraftInput {
  return {
    ...demoDraft(),
    payments: [{ id: "pay-1", method: "CARD", amountCents: 27_278, receivedAt: "2026-03-12", reference: "" }],
  };
}

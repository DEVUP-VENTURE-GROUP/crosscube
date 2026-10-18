import type { CatalogItemDoc, Collections, TaxCategoryDoc } from "@/lib/db/collections";
import type { CatalogItem, TaxCategory } from "./catalog.types";

export const MAX_CATALOG_ITEMS = 5000;

export function toCatalogItem({ _id, createdAt, updatedAt, ...rest }: CatalogItemDoc): CatalogItem {
  return { id: _id, ...rest, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() };
}

export function toTaxCategory({ _id, createdAt, updatedAt, ...rest }: TaxCategoryDoc): TaxCategory {
  return { id: _id, ...rest, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() };
}

export async function findCatalogItems(c: Collections, options: { includeInactive: boolean }): Promise<CatalogItem[]> {
  const docs = await c.catalogItems
    .find(options.includeInactive ? {} : { active: true })
    .sort({ kind: 1, name: 1 })
    .limit(MAX_CATALOG_ITEMS)
    .toArray();
  return docs.map(toCatalogItem);
}

export async function findCatalogItemsByIds(c: Collections, ids: readonly string[]): Promise<CatalogItem[]> {
  if (ids.length === 0) return [];
  const docs = await c.catalogItems.find({ _id: { $in: [...new Set(ids)] } }).toArray();
  return docs.map(toCatalogItem);
}

export async function findTaxCategories(c: Collections): Promise<TaxCategory[]> {
  const docs = await c.taxCategories.find({}).sort({ code: 1 }).limit(200).toArray();
  return docs.map(toTaxCategory);
}

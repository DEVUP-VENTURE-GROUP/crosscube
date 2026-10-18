import { MongoServerError } from "mongodb";
import { db } from "@/lib/db/mongo";
import { AppError, notFound, validationFailed } from "@/lib/errors/app-error";
import type { CatalogLookup } from "@/modules/invoices/invoice.compute";
import {
  findCatalogItems,
  findCatalogItemsByIds,
  findTaxCategories,
  toCatalogItem,
  toTaxCategory,
} from "./catalog.repository";
import { buildSearchIndex, searchCatalog } from "./catalog.search";
import type { CatalogItem, TaxCategory } from "./catalog.types";
import type { CatalogItemInput, TaxCategoryInput } from "./catalog.validation";

function isDuplicateKey(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000;
}

export async function listCatalog(options: { includeInactive: boolean; query?: string }): Promise<CatalogItem[]> {
  const items = await findCatalogItems(await db(), options);
  if (!options.query) return items;
  return searchCatalog(buildSearchIndex(items), options.query, { limit: 50, includeInactive: options.includeInactive });
}

export async function listTaxCategories(): Promise<TaxCategory[]> {
  return findTaxCategories(await db());
}

export async function loadCatalogLookup(itemIds: readonly string[]): Promise<CatalogLookup> {
  const c = await db();
  const [items, taxCategories] = await Promise.all([findCatalogItemsByIds(c, itemIds), findTaxCategories(c)]);
  return {
    items: new Map(items.map((item) => [item.id, item])),
    taxCategories: new Map(taxCategories.map((category) => [category.id, category])),
  };
}

async function assertReferences(input: CatalogItemInput, selfId: string | null): Promise<void> {
  const c = await db();
  if (input.taxCategoryId && !(await c.taxCategories.findOne({ _id: input.taxCategoryId }))) {
    throw validationFailed("Unknown tax category.", [{ severity: "error", path: "taxCategoryId", message: "Tax category does not exist." }]);
  }
  if (input.associatedLaborId) {
    const labor = await c.catalogItems.findOne({ _id: input.associatedLaborId });
    const message =
      input.associatedLaborId === selfId
        ? "An item cannot be associated with itself."
        : !labor
          ? "Associated labor operation does not exist."
          : labor.kind !== "LABOR"
            ? "Associated item must be a labor operation."
            : null;
    if (message) throw validationFailed(message, [{ severity: "error", path: "associatedLaborId", message }]);
  }
}

export async function createCatalogItem(input: CatalogItemInput): Promise<CatalogItem> {
  await assertReferences(input, null);
  const now = new Date();
  const doc = { _id: crypto.randomUUID(), ...input, isDemo: false, createdAt: now, updatedAt: now };
  try {
    await (await db()).catalogItems.insertOne(doc);
  } catch (error) {
    if (isDuplicateKey(error)) throw new AppError(409, "DUPLICATE", `SKU ${input.sku} is already used by another item.`);
    throw error;
  }
  return toCatalogItem(doc);
}

// Existing invoices keep their own line snapshots, so catalog edits never alter issued invoices.
export async function updateCatalogItem(id: string, input: CatalogItemInput): Promise<CatalogItem> {
  await assertReferences(input, id);
  try {
    const doc = await (await db()).catalogItems.findOneAndUpdate(
      { _id: id },
      { $set: { ...input, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!doc) throw notFound("Catalog item");
    return toCatalogItem(doc);
  } catch (error) {
    if (isDuplicateKey(error)) throw new AppError(409, "DUPLICATE", `SKU ${input.sku} is already used by another item.`);
    throw error;
  }
}

export async function createTaxCategory(input: TaxCategoryInput): Promise<TaxCategory> {
  const now = new Date();
  const doc = { _id: crypto.randomUUID(), ...input, isDemo: false, createdAt: now, updatedAt: now };
  try {
    await (await db()).taxCategories.insertOne(doc);
  } catch (error) {
    if (isDuplicateKey(error)) throw new AppError(409, "DUPLICATE", `Tax category code ${input.code} already exists.`);
    throw error;
  }
  return toTaxCategory(doc);
}

export async function updateTaxCategory(id: string, input: TaxCategoryInput): Promise<TaxCategory> {
  try {
    const doc = await (await db()).taxCategories.findOneAndUpdate(
      { _id: id },
      { $set: { ...input, isDemo: false, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!doc) throw notFound("Tax category");
    return toTaxCategory(doc);
  } catch (error) {
    if (isDuplicateKey(error)) throw new AppError(409, "DUPLICATE", `Tax category code ${input.code} already exists.`);
    throw error;
  }
}

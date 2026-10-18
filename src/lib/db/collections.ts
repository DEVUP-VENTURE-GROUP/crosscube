import type { Collection, Db } from "mongodb";
import type { CatalogItem, TaxCategory } from "@/modules/catalog/catalog.types";
import type { CustomerSnapshot, Invoice, VehicleSnapshot } from "@/modules/invoices/invoice.types";
import type { ShopSettingsInput } from "@/modules/settings/settings.types";

type WithDates<T> = Omit<T, "createdAt" | "updatedAt"> & { createdAt: Date; updatedAt: Date };

export type SettingsDoc = ShopSettingsInput & { _id: "shop"; updatedAt: Date };
export interface CounterDoc {
  _id: "invoice";
  next: number;
}
export type TaxCategoryDoc = WithDates<Omit<TaxCategory, "id">> & { _id: string };
export type CatalogItemDoc = WithDates<Omit<CatalogItem, "id">> & { _id: string };
export type CustomerDoc = CustomerSnapshot & { _id: string; phoneDigits: string; createdAt: Date; updatedAt: Date };
export type VehicleDoc = VehicleSnapshot & { _id: string; customerId: string | null; createdAt: Date; updatedAt: Date };

export type InvoiceDoc = Omit<Invoice, "id" | "createdAt" | "updatedAt" | "finalizedAt" | "voidedAt"> & {
  _id: string;
  idempotencyKey: string | null;
  lock: { token: string; at: Date } | null;
  reservedSequence: number | null;
  createdAt: Date;
  updatedAt: Date;
  finalizedAt: Date | null;
  voidedAt: Date | null;
};

export interface Collections {
  settings: Collection<SettingsDoc>;
  counters: Collection<CounterDoc>;
  taxCategories: Collection<TaxCategoryDoc>;
  catalogItems: Collection<CatalogItemDoc>;
  customers: Collection<CustomerDoc>;
  vehicles: Collection<VehicleDoc>;
  invoices: Collection<InvoiceDoc>;
}

export function collections(db: Db): Collections {
  return {
    settings: db.collection<SettingsDoc>("settings"),
    counters: db.collection<CounterDoc>("counters"),
    taxCategories: db.collection<TaxCategoryDoc>("tax_categories"),
    catalogItems: db.collection<CatalogItemDoc>("catalog_items"),
    customers: db.collection<CustomerDoc>("customers"),
    vehicles: db.collection<VehicleDoc>("vehicles"),
    invoices: db.collection<InvoiceDoc>("invoices"),
  };
}

export async function ensureIndexes(c: Collections): Promise<void> {
  const unique = (field: string) => ({ unique: true, partialFilterExpression: { [field]: { $type: "string" } } });
  await Promise.all([
    c.taxCategories.createIndex({ code: 1 }, { unique: true }),
    c.catalogItems.createIndex({ sku: 1 }, unique("sku")),
    c.catalogItems.createIndex({ kind: 1, active: 1 }),
    c.customers.createIndex({ phoneDigits: 1 }),
    c.customers.createIndex({ name: 1 }),
    c.vehicles.createIndex({ vin: 1 }),
    c.vehicles.createIndex({ customerId: 1 }),
    c.vehicles.createIndex({ licensePlate: 1 }),
    c.invoices.createIndex({ invoiceNumber: 1 }, unique("invoiceNumber")),
    c.invoices.createIndex({ sequenceNumber: 1 }, { unique: true, partialFilterExpression: { sequenceNumber: { $type: "number" } } }),
    c.invoices.createIndex({ idempotencyKey: 1 }, unique("idempotencyKey")),
    c.invoices.createIndex({ createdAt: -1, _id: -1 }),
    c.invoices.createIndex({ status: 1, createdAt: -1, _id: -1 }),
  ]);
  await c.counters.updateOne({ _id: "invoice" }, { $setOnInsert: { next: 1 } }, { upsert: true });
}

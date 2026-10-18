import type { LineKind } from "@/modules/pricing/pricing.types";

export interface TaxCategory {
  id: string;
  code: string;
  name: string;
  ratePpm: number;
  active: boolean;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogItem {
  id: string;
  kind: LineKind;
  name: string;
  invoiceDescription: string;
  sku: string | null;
  category: string;
  unit: string;
  defaultQuantityMilli: number;
  unitPriceCents: number;
  taxCategoryId: string | null;
  keywords: string[];
  active: boolean;
  priceEditable: boolean;
  quantityEditable: boolean;
  associatedLaborId: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

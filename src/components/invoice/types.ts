import type { CatalogItem, TaxCategory } from "@/modules/catalog/catalog.types";
import type { ShopSettings } from "@/modules/settings/settings.types";

export interface ReferenceData {
  catalog: CatalogItem[];
  taxCategories: TaxCategory[];
  settings: ShopSettings;
}

import { json, route } from "@/lib/http/route";
import { listCatalog, listTaxCategories } from "@/modules/catalog/catalog.service";
import { getSettings } from "@/modules/settings/settings.service";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const [catalog, taxCategories, settings] = await Promise.all([
    listCatalog({ includeInactive: true }),
    listTaxCategories(),
    getSettings(),
  ]);
  return json({ catalog, taxCategories, settings });
});

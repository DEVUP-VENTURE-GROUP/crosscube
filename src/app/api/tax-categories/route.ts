import { json, readJson, route } from "@/lib/http/route";
import { createTaxCategory, listTaxCategories } from "@/modules/catalog/catalog.service";
import { taxCategoryInputSchema } from "@/modules/catalog/catalog.validation";

export const dynamic = "force-dynamic";

export const GET = route(async () => json({ items: await listTaxCategories() }));

export const POST = route(async (request: Request) => {
  const item = await createTaxCategory(await readJson(request, taxCategoryInputSchema));
  return json({ item }, { status: 201 });
});

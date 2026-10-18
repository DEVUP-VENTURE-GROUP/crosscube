import { json, parseId, readJson, route } from "@/lib/http/route";
import { updateTaxCategory } from "@/modules/catalog/catalog.service";
import { taxCategoryInputSchema } from "@/modules/catalog/catalog.validation";

export const dynamic = "force-dynamic";

export const PUT = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = parseId((await params).id);
  const item = await updateTaxCategory(id, await readJson(request, taxCategoryInputSchema));
  return json({ item });
});

import { json, parseId, readJson, route } from "@/lib/http/route";
import { deleteTaxCategory, updateTaxCategory } from "@/modules/catalog/catalog.service";
import { taxCategoryInputSchema } from "@/modules/catalog/catalog.validation";

export const dynamic = "force-dynamic";

export const PUT = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = parseId((await params).id);
  const item = await updateTaxCategory(id, await readJson(request, taxCategoryInputSchema));
  return json({ item });
});

export const DELETE = route(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await deleteTaxCategory(parseId((await params).id));
  return new Response(null, { status: 204 });
});

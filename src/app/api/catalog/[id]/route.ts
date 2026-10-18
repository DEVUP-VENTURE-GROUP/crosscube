import { json, parseId, readJson, route } from "@/lib/http/route";
import { updateCatalogItem } from "@/modules/catalog/catalog.service";
import { catalogItemInputSchema } from "@/modules/catalog/catalog.validation";

export const dynamic = "force-dynamic";

export const PUT = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = parseId((await params).id);
  const item = await updateCatalogItem(id, await readJson(request, catalogItemInputSchema));
  return json({ item });
});

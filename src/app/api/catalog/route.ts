import { json, readJson, route } from "@/lib/http/route";
import { createCatalogItem, listCatalog } from "@/modules/catalog/catalog.service";
import { catalogItemInputSchema } from "@/modules/catalog/catalog.validation";

export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const items = await listCatalog({
    includeInactive: params.get("includeInactive") === "1",
    query: params.get("q")?.slice(0, 100) || undefined,
  });
  return json({ items });
});

export const POST = route(async (request: Request) => {
  const item = await createCatalogItem(await readJson(request, catalogItemInputSchema));
  return json({ item }, { status: 201 });
});

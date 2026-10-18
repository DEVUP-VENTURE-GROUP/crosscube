import { json, parseId, readJson, route } from "@/lib/http/route";
import { deleteDraft, getInvoice, saveDraft } from "@/modules/invoices/invoice.service";
import { saveDraftRequestSchema } from "@/modules/invoices/invoice.validation";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, { params }: Context) => {
  return json({ invoice: await getInvoice(parseId((await params).id)) });
});

export const PUT = route(async (request: Request, { params }: Context) => {
  const id = parseId((await params).id);
  const body = await readJson(request, saveDraftRequestSchema);
  return json(await saveDraft(id, body.version, body.draft));
});

export const DELETE = route(async (_request: Request, { params }: Context) => {
  await deleteDraft(parseId((await params).id));
  return new Response(null, { status: 204 });
});

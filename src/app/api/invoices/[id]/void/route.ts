import { json, parseId, readJson, route } from "@/lib/http/route";
import { voidInvoice } from "@/modules/invoices/invoice.service";
import { voidRequestSchema } from "@/modules/invoices/invoice.validation";

export const dynamic = "force-dynamic";

export const POST = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = parseId((await params).id);
  const { reason } = await readJson(request, voidRequestSchema);
  return json({ invoice: await voidInvoice(id, reason) });
});

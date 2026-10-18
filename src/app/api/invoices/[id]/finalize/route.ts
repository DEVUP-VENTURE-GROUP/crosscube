import { json, parseId, route } from "@/lib/http/route";
import { finalizeInvoice } from "@/modules/invoices/invoice.service";

export const dynamic = "force-dynamic";

export const POST = route(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const result = await finalizeInvoice(parseId((await params).id));
  return json(result, { status: result.alreadyFinalized ? 200 : 201 });
});

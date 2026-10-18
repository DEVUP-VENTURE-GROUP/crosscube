import { json, parseId, route } from "@/lib/http/route";
import { reissueInvoice } from "@/modules/invoices/invoice.service";

export const dynamic = "force-dynamic";

export const POST = route(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  return json({ invoice: await reissueInvoice(parseId((await params).id)) }, { status: 201 });
});

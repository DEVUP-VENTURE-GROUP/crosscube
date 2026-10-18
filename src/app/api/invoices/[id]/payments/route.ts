import { json, parseId, readJson, route } from "@/lib/http/route";
import { recordPayment } from "@/modules/invoices/invoice.service";
import { recordPaymentRequestSchema } from "@/modules/invoices/invoice.validation";

export const dynamic = "force-dynamic";

export const POST = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = parseId((await params).id);
  const body = await readJson(request, recordPaymentRequestSchema);
  return json({ invoice: await recordPayment(id, body.version, body.payment) });
});

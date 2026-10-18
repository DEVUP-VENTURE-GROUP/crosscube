import { json, readJson, route } from "@/lib/http/route";
import { INVOICE_STATUSES, type InvoiceStatus } from "@/modules/invoices/invoice.types";
import { createDraft, listInvoices } from "@/modules/invoices/invoice.service";
import { createDraftRequestSchema } from "@/modules/invoices/invoice.validation";

export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const limit = Math.min(Math.max(Number(params.get("limit")) || 25, 1), 100);
  const page = await listInvoices({
    status: INVOICE_STATUSES.includes(status as InvoiceStatus) ? (status as InvoiceStatus) : undefined,
    cursor: params.get("cursor") ?? undefined,
    limit,
  });
  return json(page);
});

export const POST = route(async (request: Request) => {
  const body = await readJson(request, createDraftRequestSchema);
  const invoice = await createDraft(body.idempotencyKey, body.draft);
  return json({ invoice }, { status: 201 });
});

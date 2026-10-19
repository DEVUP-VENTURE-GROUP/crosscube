import { serverEnv } from "@/lib/config/env";
import { parseId, route } from "@/lib/http/route";
import { getInvoice } from "@/modules/invoices/invoice.service";
import { buildInvoiceDocumentModel } from "@/modules/pdf/invoice-document-model";
import { pdfFileName, pdfRenderer } from "@/modules/pdf/invoice-pdf.service";
import { remotePdfRenderer } from "@/modules/pdf/remote-pdf-renderer";
import { getSettings } from "@/modules/settings/settings.service";
import { toBusinessSnapshot } from "@/modules/settings/settings.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Finalized invoices render only from their stored snapshot; drafts use current settings and carry a DRAFT watermark.
export const GET = route(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const invoice = await getInvoice(parseId((await params).id));
  const business = invoice.business ?? toBusinessSnapshot(await getSettings());
  const model = buildInvoiceDocumentModel(invoice, business, new Date());
  const env = serverEnv();
  const renderer =
    env.PDF_SERVICE_URL && env.PDF_SERVICE_TOKEN
      ? remotePdfRenderer({ url: env.PDF_SERVICE_URL, token: env.PDF_SERVICE_TOKEN, timeoutMs: env.PDF_RENDER_TIMEOUT_MS + 10_000 })
      : pdfRenderer({ maxConcurrency: env.PDF_MAX_CONCURRENCY, maxQueue: 20, timeoutMs: env.PDF_RENDER_TIMEOUT_MS });
  const pdf = await renderer.render(model);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfFileName(model)}"`,
      "Content-Length": String(pdf.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
});

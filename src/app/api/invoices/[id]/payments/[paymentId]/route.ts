import { AppError } from "@/lib/errors/app-error";
import { json, parseId, route } from "@/lib/http/route";
import { removePayment } from "@/modules/invoices/invoice.service";

export const dynamic = "force-dynamic";

export const DELETE = route(async (request: Request, { params }: { params: Promise<{ id: string; paymentId: string }> }) => {
  const { id, paymentId } = await params;
  const version = Number(new URL(request.url).searchParams.get("version"));
  if (!Number.isInteger(version) || version < 1) throw new AppError(400, "BAD_REQUEST", "A valid version is required.");
  return json({ invoice: await removePayment(parseId(id), version, parseId(paymentId)) });
});

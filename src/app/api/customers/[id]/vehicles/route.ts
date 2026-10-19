import { json, parseId, readJson, route } from "@/lib/http/route";
import { createVehicle } from "@/modules/customers/customer.service";
import { vehicleSnapshotSchema } from "@/modules/invoices/invoice.validation";

export const dynamic = "force-dynamic";

export const POST = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const customerId = parseId((await params).id);
  return json({ vehicle: await createVehicle(customerId, await readJson(request, vehicleSnapshotSchema)) }, { status: 201 });
});

import { json, parseId, readJson, route } from "@/lib/http/route";
import { deleteVehicle, updateVehicle } from "@/modules/customers/customer.service";
import { vehicleSnapshotSchema } from "@/modules/invoices/invoice.validation";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const PUT = route(async (request: Request, { params }: Context) => {
  const id = parseId((await params).id);
  return json({ vehicle: await updateVehicle(id, await readJson(request, vehicleSnapshotSchema)) });
});

export const DELETE = route(async (_request: Request, { params }: Context) => {
  await deleteVehicle(parseId((await params).id));
  return new Response(null, { status: 204 });
});

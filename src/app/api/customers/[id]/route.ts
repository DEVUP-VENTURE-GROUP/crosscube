import { json, parseId, readJson, route } from "@/lib/http/route";
import { deleteCustomer, getCustomer, updateCustomer } from "@/modules/customers/customer.service";
import { customerSnapshotSchema } from "@/modules/invoices/invoice.validation";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, { params }: Context) => json({ customer: await getCustomer(parseId((await params).id)) }));

export const PUT = route(async (request: Request, { params }: Context) => {
  const id = parseId((await params).id);
  return json({ customer: await updateCustomer(id, await readJson(request, customerSnapshotSchema)) });
});

export const DELETE = route(async (_request: Request, { params }: Context) => {
  await deleteCustomer(parseId((await params).id));
  return new Response(null, { status: 204 });
});

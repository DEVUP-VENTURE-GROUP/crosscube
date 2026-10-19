import { json, readJson, route } from "@/lib/http/route";
import { createCustomer, listCustomers, searchCustomers } from "@/modules/customers/customer.service";
import { customerSnapshotSchema } from "@/modules/invoices/invoice.validation";

export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const query = params.get("q") ?? "";
  const items = params.get("mode") === "lookup" ? await searchCustomers(query) : await listCustomers(query);
  return json({ items });
});

export const POST = route(async (request: Request) => {
  const customer = await createCustomer(await readJson(request, customerSnapshotSchema));
  return json({ customer }, { status: 201 });
});

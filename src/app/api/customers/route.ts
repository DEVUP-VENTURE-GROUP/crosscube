import { json, route } from "@/lib/http/route";
import { searchCustomers } from "@/modules/customers/customer.service";

export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  return json({ items: await searchCustomers(query) });
});

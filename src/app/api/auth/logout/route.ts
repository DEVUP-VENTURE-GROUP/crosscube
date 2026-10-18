import { SESSION_COOKIE } from "@/lib/auth/session";
import { json, route } from "@/lib/http/route";

export const dynamic = "force-dynamic";

export const POST = route(async () => {
  const response = json({ ok: true });
  response.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return response;
});

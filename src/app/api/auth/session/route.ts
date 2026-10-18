import { cookies } from "next/headers";
import { authConfig } from "@/lib/auth/config";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { json, route } from "@/lib/http/route";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const config = authConfig();
  if (config.mode !== "enabled") return json({ authEnabled: false, username: null });
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value, config.secret);
  return json({ authEnabled: true, username: session?.username ?? null, expiresAt: session?.expiresAt ?? null });
});

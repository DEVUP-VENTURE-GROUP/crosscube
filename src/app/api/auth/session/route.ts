import { cookies } from "next/headers";
import { authConfig } from "@/lib/auth/config";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { db } from "@/lib/db/mongo";
import { json, route } from "@/lib/http/route";
import { readSettings } from "@/modules/settings/settings.service";

export const dynamic = "force-dynamic";

// Business name is public (it is printed on every invoice) and labels the sign-in page.
async function businessName(): Promise<string | null> {
  try {
    return (await readSettings(await db())).businessName;
  } catch {
    return null;
  }
}

export const GET = route(async () => {
  const config = authConfig();
  const name = await businessName();
  if (config.mode !== "enabled") return json({ authEnabled: false, username: null, businessName: name });
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value, config.secret);
  return json({ authEnabled: true, username: session?.username ?? null, expiresAt: session?.expiresAt ?? null, businessName: name });
});

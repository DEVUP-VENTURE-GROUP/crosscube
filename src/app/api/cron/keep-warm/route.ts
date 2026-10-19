import { safeEqual } from "@/lib/auth/password";
import { json } from "@/lib/http/route";
import { logger } from "@/lib/logging/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Called by Vercel Cron (vercel.json) so a free-tier PDF service never sleeps; Vercel sends CRON_SECRET as a bearer token.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return json({ error: { code: "UNAUTHENTICATED", message: "Unauthorized." } }, { status: 401 });
  }
  const serviceUrl = process.env.PDF_SERVICE_URL;
  if (!serviceUrl) return json({ ok: true, skipped: "PDF_SERVICE_URL not set" });

  const started = Date.now();
  try {
    const response = await fetch(new URL("/healthz", serviceUrl), { cache: "no-store", signal: AbortSignal.timeout(55_000) });
    const ms = Date.now() - started;
    logger.info("PDF service keep-warm", { status: response.status, ms });
    return json({ ok: response.ok, status: response.status, ms }, { status: response.ok ? 200 : 502 });
  } catch (error) {
    logger.warn("PDF service keep-warm failed", { error: error instanceof Error ? error.name : "unknown" });
    return json({ ok: false, error: "PDF service did not respond" }, { status: 502 });
  }
}

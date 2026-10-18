import { z } from "zod";
import { authConfig } from "@/lib/auth/config";
import { safeEqual, verifyPassword } from "@/lib/auth/password";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth/session";
import { AppError } from "@/lib/errors/app-error";
import { json, readJson, route } from "@/lib/http/route";
import { logger } from "@/lib/logging/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ username: z.string().max(100), password: z.string().max(200) }).strict();

const globalForLimiter = globalThis as typeof globalThis & { __loginLimiter?: ReturnType<typeof createRateLimiter> };
const limiter = (globalForLimiter.__loginLimiter ??= createRateLimiter({ maxFailures: 5, windowMs: 15 * 60 * 1000 }));

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

export const POST = route(async (request: Request) => {
  const config = authConfig();
  if (config.mode !== "enabled") {
    throw new AppError(503, "INTERNAL", config.mode === "misconfigured" ? config.reason : "Login is not enabled on this server.");
  }
  const { username, password } = await readJson(request, bodySchema);
  const key = `${clientIp(request)}|${username.toLowerCase()}`;
  const gate = limiter.check(key);
  if (!gate.allowed) {
    return json(
      { error: { code: "RATE_LIMITED", message: `Too many failed attempts. Try again in ${Math.ceil(gate.retryAfterSeconds / 60)} minute(s).` } },
      { status: 429, headers: { "Retry-After": String(gate.retryAfterSeconds) } },
    );
  }

  const passwordOk = await verifyPassword(password, config.passwordHash);
  const usernameOk = safeEqual(username.trim(), config.username);
  if (!passwordOk || !usernameOk) {
    limiter.recordFailure(key);
    logger.warn("Failed login attempt", { ip: clientIp(request) });
    return json({ error: { code: "INVALID_CREDENTIALS", message: "Incorrect username or password." } }, { status: 401 });
  }

  limiter.reset(key);
  const token = await createSessionToken(config.username, config.secret);
  const response = json({ ok: true, username: config.username });
  const secure = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure ? "; Secure" : ""}`,
  );
  logger.info("User signed in");
  return response;
});

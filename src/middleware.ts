import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/lib/auth/config";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

// The cron route authenticates itself with CRON_SECRET.
const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/auth/logout", "/api/auth/session", "/api/cron/keep-warm"]);

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Session cookies are sent automatically, so cross-site writes must be rejected explicitly.
function crossSiteBlock(request: NextRequest): NextResponse | null {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return null;
  if (request.headers.get("sec-fetch-site") === "cross-site") return apiError(403, "BAD_REQUEST", "Cross-site request rejected.");
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return apiError(403, "BAD_REQUEST", "Origin mismatch.");
  return null;
}

export async function middleware(request: NextRequest) {
  const blocked = crossSiteBlock(request);
  if (blocked) return blocked;

  const { pathname, search } = request.nextUrl;
  const config = authConfig();
  if (config.mode === "misconfigured") {
    return pathname.startsWith("/api/") ? apiError(503, "INTERNAL", config.reason) : new NextResponse(config.reason, { status: 503 });
  }
  if (config.mode === "disabled") {
    return pathname === "/login" ? NextResponse.redirect(new URL("/invoice", request.url)) : NextResponse.next();
  }

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, config.secret);
  if (pathname === "/login" && session) return NextResponse.redirect(new URL("/invoice", request.url));
  if (PUBLIC_PATHS.has(pathname) || session) return NextResponse.next();

  if (pathname.startsWith("/api/")) return apiError(401, "UNAUTHENTICATED", "Your session has expired. Sign in again.");
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};

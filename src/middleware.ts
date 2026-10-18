import { NextResponse, type NextRequest } from "next/server";

function timingSafeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Invoice Generator", charset="UTF-8"' },
  });
}

function checkAuth(request: NextRequest): NextResponse | null {
  const user = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !password) {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_UNAUTHENTICATED !== "true") {
      return new NextResponse("Authentication is not configured. Set BASIC_AUTH_USER and BASIC_AUTH_PASSWORD.", { status: 503 });
    }
    return null;
  }
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return unauthorized();
  let decoded = "";
  try {
    decoded = atob(header.slice(6));
  } catch {
    return unauthorized();
  }
  const separator = decoded.indexOf(":");
  const ok = separator > 0 && timingSafeEqual(decoded.slice(0, separator), user) && timingSafeEqual(decoded.slice(separator + 1), password);
  return ok ? null : unauthorized();
}

// Basic auth is replayed by browsers automatically, so cross-site writes must be rejected explicitly.
function checkCrossSite(request: NextRequest): NextResponse | null {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return null;
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Cross-site request rejected." } }, { status: 403 });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Origin mismatch." } }, { status: 403 });
  }
  return null;
}

export function middleware(request: NextRequest) {
  return checkAuth(request) ?? checkCrossSite(request) ?? NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

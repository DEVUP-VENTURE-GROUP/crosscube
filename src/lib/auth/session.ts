export const SESSION_COOKIE = "inv_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export interface Session {
  username: string;
  issuedAt: number;
  expiresAt: number;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  try {
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

// Web Crypto only, so the same code runs in the edge middleware and in Node route handlers.
export async function createSessionToken(username: string, secret: string, now = Date.now()): Promise<string> {
  const issuedAt = Math.floor(now / 1000);
  const payload = toBase64Url(encoder.encode(JSON.stringify({ u: username, iat: issuedAt, exp: issuedAt + SESSION_TTL_SECONDS })));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload)));
  return `${payload}.${toBase64Url(signature)}`;
}

export async function verifySessionToken(token: string | undefined, secret: string, now = Date.now()): Promise<Session | null> {
  if (!token || token.length > 1024) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const signatureBytes = fromBase64Url(signature);
  if (!signatureBytes) return null;
  const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret), signatureBytes, encoder.encode(payload));
  if (!valid) return null;
  const json = fromBase64Url(payload);
  if (!json) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(json)) as { u?: unknown; iat?: unknown; exp?: unknown };
    if (typeof data.u !== "string" || typeof data.iat !== "number" || typeof data.exp !== "number") return null;
    if (data.exp <= Math.floor(now / 1000)) return null;
    return { username: data.u, issuedAt: data.iat, expiresAt: data.exp };
  } catch {
    return null;
  }
}

export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\") || value.startsWith("/login")) return "/invoice";
  return value.slice(0, 500);
}

import { describe, expect, it } from "vitest";
import { hashPassword, safeEqual, verifyPassword } from "@/lib/auth/password";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { createSessionToken, safeNextPath, SESSION_TTL_SECONDS, verifySessionToken } from "@/lib/auth/session";

const SECRET = "unit-test-secret-0123456789abcdef0123456789";

describe("session tokens", () => {
  it("round-trips a signed session", async () => {
    const now = Date.UTC(2026, 9, 18, 12);
    const token = await createSessionToken("admin", SECRET, now);
    expect(await verifySessionToken(token, SECRET, now + 1000)).toMatchObject({ username: "admin", expiresAt: now / 1000 + SESSION_TTL_SECONDS });
  });

  it("rejects tampered, foreign-key, malformed and expired tokens", async () => {
    const now = Date.UTC(2026, 9, 18, 12);
    const token = await createSessionToken("admin", SECRET, now);
    const [payload, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "root", iat: now / 1000, exp: now / 1000 + 999_999 })).toString("base64url");
    expect(await verifySessionToken(`${forged}.${signature}`, SECRET, now)).toBeNull();
    expect(await verifySessionToken(`${payload}.${signature!.slice(0, -2)}AA`, SECRET, now)).toBeNull();
    expect(await verifySessionToken(token, `${SECRET}-other`, now)).toBeNull();
    expect(await verifySessionToken("garbage", SECRET, now)).toBeNull();
    expect(await verifySessionToken(`${token}.extra`, SECRET, now)).toBeNull();
    expect(await verifySessionToken(undefined, SECRET, now)).toBeNull();
    expect(await verifySessionToken(token, SECRET, now + (SESSION_TTL_SECONDS + 1) * 1000)).toBeNull();
  });
});

describe("password hashing", () => {
  it("verifies only the original password and salts each hash", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).toMatch(/^scrypt:16384:8:1:[\w-]+:[\w-]+$/);
    expect(hash).not.toContain("$");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("correct horse batterY", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
    expect(await hashPassword("correct horse battery")).not.toBe(hash);
  });

  it("rejects malformed or unsafe hash strings", async () => {
    expect(await verifyPassword("x", "plain-text")).toBe(false);
    expect(await verifyPassword("x", "scrypt:99999999:8:1:abc:def")).toBe(false);
    expect(await verifyPassword("x", "bcrypt:1:2:3:4:5")).toBe(false);
  });

  it("compares strings safely", () => {
    expect(safeEqual("admin", "admin")).toBe(true);
    expect(safeEqual("admin", "Admin")).toBe(false);
    expect(safeEqual("admin", "admin2")).toBe(false);
  });
});

describe("login rate limiter", () => {
  it("blocks after the configured failures and unblocks after the window", () => {
    const limiter = createRateLimiter({ maxFailures: 3, windowMs: 60_000 });
    for (let i = 0; i < 3; i++) {
      expect(limiter.check("ip|admin", 0).allowed).toBe(true);
      limiter.recordFailure("ip|admin", 0);
    }
    expect(limiter.check("ip|admin", 1000)).toEqual({ allowed: false, retryAfterSeconds: 59 });
    expect(limiter.check("other|admin", 1000).allowed).toBe(true);
    expect(limiter.check("ip|admin", 60_001).allowed).toBe(true);
  });

  it("resets on success and caps memory", () => {
    const limiter = createRateLimiter({ maxFailures: 1, windowMs: 60_000, maxKeys: 2 });
    limiter.recordFailure("a", 0);
    limiter.reset("a");
    expect(limiter.check("a", 0).allowed).toBe(true);
    limiter.recordFailure("b", 0);
    limiter.recordFailure("c", 0);
    limiter.recordFailure("d", 0);
    expect(limiter.check("b", 0).allowed).toBe(true);
    expect(limiter.check("d", 0).allowed).toBe(false);
  });
});

describe("post-login redirect", () => {
  it("only allows same-site relative paths", () => {
    expect(safeNextPath("/invoices?status=DRAFT")).toBe("/invoices?status=DRAFT");
    expect(safeNextPath("//evil.example")).toBe("/invoice");
    expect(safeNextPath("/\\evil.example")).toBe("/invoice");
    expect(safeNextPath("https://evil.example")).toBe("/invoice");
    expect(safeNextPath("/login")).toBe("/invoice");
    expect(safeNextPath(null)).toBe("/invoice");
  });
});

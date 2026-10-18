export type AuthConfig =
  | { mode: "enabled"; username: string; passwordHash: string; secret: string }
  | { mode: "disabled" }
  | { mode: "misconfigured"; reason: string };

export function authConfig(): AuthConfig {
  const username = process.env.AUTH_USERNAME?.trim();
  const passwordHash = process.env.AUTH_PASSWORD_HASH?.trim();
  const secret = process.env.AUTH_SECRET?.trim();
  if (username || passwordHash) {
    if (!username || !passwordHash) return { mode: "misconfigured", reason: "Set both AUTH_USERNAME and AUTH_PASSWORD_HASH." };
    if (!passwordHash.startsWith("scrypt:")) return { mode: "misconfigured", reason: "AUTH_PASSWORD_HASH must be generated with npm run auth:hash-password." };
    if (!secret || secret.length < 32) return { mode: "misconfigured", reason: "AUTH_SECRET must be at least 32 characters." };
    return { mode: "enabled", username, passwordHash, secret };
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_UNAUTHENTICATED !== "true") {
    return { mode: "misconfigured", reason: "Login is not configured. Set AUTH_USERNAME, AUTH_PASSWORD_HASH and AUTH_SECRET." };
  }
  return { mode: "disabled" };
}

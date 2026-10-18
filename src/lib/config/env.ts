import "server-only";
import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB: z.string().regex(/^[A-Za-z0-9_-]{1,63}$/).default("auto_invoice"),
  PDF_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  PDF_RENDER_TIMEOUT_MS: z.coerce.number().int().min(2000).max(120_000).default(20_000),
});

export type ServerEnv = z.infer<typeof envSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= envSchema.parse({
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_DB: process.env.MONGODB_DB || undefined,
    PDF_MAX_CONCURRENCY: process.env.PDF_MAX_CONCURRENCY || undefined,
    PDF_RENDER_TIMEOUT_MS: process.env.PDF_RENDER_TIMEOUT_MS || undefined,
  });
  return cached;
}

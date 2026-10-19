import "server-only";
import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB: z.string().regex(/^[A-Za-z0-9_-]{1,63}$/).default("auto_invoice"),
  PDF_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  PDF_RENDER_TIMEOUT_MS: z.coerce.number().int().min(2000).max(120_000).default(20_000),
  PDF_SERVICE_URL: z.string().url().refine((v) => /^https?:\/\//.test(v), "PDF_SERVICE_URL must be http(s)").optional(),
  PDF_SERVICE_TOKEN: z.string().min(32, "PDF_SERVICE_TOKEN must be at least 32 characters").optional(),
}).refine((env) => !env.PDF_SERVICE_URL || env.PDF_SERVICE_TOKEN, { message: "PDF_SERVICE_TOKEN is required when PDF_SERVICE_URL is set", path: ["PDF_SERVICE_TOKEN"] });

export type ServerEnv = z.infer<typeof envSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= envSchema.parse({
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_DB: process.env.MONGODB_DB || undefined,
    PDF_MAX_CONCURRENCY: process.env.PDF_MAX_CONCURRENCY || undefined,
    PDF_RENDER_TIMEOUT_MS: process.env.PDF_RENDER_TIMEOUT_MS || undefined,
    PDF_SERVICE_URL: process.env.PDF_SERVICE_URL || undefined,
    PDF_SERVICE_TOKEN: process.env.PDF_SERVICE_TOKEN || undefined,
  });
  return cached;
}

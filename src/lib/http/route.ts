import { NextResponse } from "next/server";
import { ZodError, type ZodType, type ZodTypeDef } from "zod";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging/logger";
import { idSchema } from "@/modules/catalog/catalog.validation";
import type { Issue } from "@/modules/invoices/invoice.types";

const MAX_BODY_BYTES = 1_000_000;

export function zodIssues(error: ZodError): Issue[] {
  return error.issues.map((issue) => ({ severity: "error", path: issue.path.join("."), message: issue.message }));
}

export async function readJson<T>(request: Request, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Expected application/json.");
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) throw new AppError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new AppError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new AppError(400, "BAD_REQUEST", "Malformed JSON.");
  }
  return schema.parse(body);
}

export function parseId(value: string): string {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw new AppError(400, "BAD_REQUEST", "Invalid id.");
  return parsed.data;
}

type Handler<C> = (request: Request, context: C) => Promise<Response>;

export function route<C>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof AppError) {
        return NextResponse.json({ error: { code: error.code, message: error.message, issues: error.issues } }, { status: error.status });
      }
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: { code: "VALIDATION_FAILED", message: "Request validation failed.", issues: zodIssues(error) } },
          { status: 400 },
        );
      }
      const errorId = crypto.randomUUID();
      logger.error("Unhandled API error", {
        errorId,
        method: request.method,
        path: new URL(request.url).pathname,
        error: error instanceof Error ? `${error.name}: ${error.message}` : "unknown",
      });
      return NextResponse.json({ error: { code: "INTERNAL", message: `Unexpected server error (ref ${errorId}).` } }, { status: 500 });
    }
  };
}

export function json(data: unknown, init?: ResponseInit): Response {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...init?.headers } });
}

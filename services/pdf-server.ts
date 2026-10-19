import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { AppError } from "../src/lib/errors/app-error";
import { logger } from "../src/lib/logging/logger";
import { invoiceDocumentModelSchema } from "../src/modules/pdf/invoice-document-model.schema";
import type { PdfRenderer } from "../src/modules/pdf/remote-pdf-renderer";

const MAX_BODY_BYTES = 2_000_000;

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function send(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), "Cache-Control": "no-store" });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<string | null> {
  if (Number(req.headers["content-length"] ?? 0) > MAX_BODY_BYTES) return null;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) return null;
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function createPdfServer(options: { token: string; renderer: PdfRenderer }): Server {
  const expected = sha256(`Bearer ${options.token}`);
  return createServer(async (req, res) => {
    try {
      const path = (req.url ?? "/").split("?")[0];
      if (req.method === "GET" && path === "/healthz") return send(res, 200, { ok: true });
      if (path !== "/render") return send(res, 404, { error: "Not found" });
      if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
      if (!timingSafeEqual(sha256(req.headers.authorization ?? ""), expected)) return send(res, 401, { error: "Unauthorized" });
      if (!(req.headers["content-type"] ?? "").startsWith("application/json")) return send(res, 415, { error: "Expected application/json" });

      const raw = await readBody(req);
      if (raw === null) return send(res, 413, { error: "Body too large" });
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        return send(res, 400, { error: "Malformed JSON" });
      }
      const parsed = invoiceDocumentModelSchema.safeParse((body as { model?: unknown } | null)?.model);
      if (!parsed.success) return send(res, 400, { error: "Invalid invoice document", issues: parsed.error.issues.slice(0, 10) });

      const pdf = await options.renderer.render(parsed.data);
      res.writeHead(200, { "Content-Type": "application/pdf", "Content-Length": pdf.byteLength, "Cache-Control": "no-store" });
      res.end(Buffer.from(pdf));
    } catch (error) {
      if (error instanceof AppError) return send(res, error.status, { error: error.message, code: error.code });
      logger.error("PDF service error", { error: error instanceof Error ? error.message : "unknown" });
      if (!res.headersSent) send(res, 500, { error: "Internal error" });
      else res.destroy();
    }
  });
}

async function main() {
  const { InvoicePdfRenderer } = await import("../src/modules/pdf/invoice-pdf.service");
  const token = process.env.PDF_SERVICE_TOKEN ?? "";
  if (token.length < 32) {
    console.error("PDF_SERVICE_TOKEN must be set to at least 32 characters.");
    process.exit(1);
  }
  const renderer = new InvoicePdfRenderer({
    maxConcurrency: Number(process.env.PDF_MAX_CONCURRENCY) || 2,
    maxQueue: Number(process.env.PDF_MAX_QUEUE) || 20,
    timeoutMs: Number(process.env.PDF_RENDER_TIMEOUT_MS) || 20_000,
  });
  const server = createPdfServer({ token, renderer });
  server.requestTimeout = 60_000;
  server.headersTimeout = 15_000;
  const port = Number(process.env.PORT) || 10_000;
  server.listen(port, () => logger.info("PDF service listening", { port }));

  const shutdown = () => {
    logger.info("PDF service shutting down");
    server.close(() => void renderer.close().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 25_000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("services/pdf-server.ts")) void main();

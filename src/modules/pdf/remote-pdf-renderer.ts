import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging/logger";
import type { InvoiceDocumentModel } from "./invoice-document-model";

export interface PdfRenderer {
  render(model: InvoiceDocumentModel): Promise<Uint8Array>;
}

const MAX_PDF_BYTES = 20 * 1024 * 1024;

export function remotePdfRenderer(options: { url: string; token: string; timeoutMs: number }): PdfRenderer {
  const endpoint = new URL("/render", options.url).toString();
  return {
    async render(model) {
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${options.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model }),
          signal: AbortSignal.timeout(options.timeoutMs),
          cache: "no-store",
        });
      } catch (error) {
        logger.error("PDF service unreachable", { error: error instanceof Error ? error.name : "unknown" });
        throw new AppError(502, "PDF_RENDER_FAILED", "The PDF service did not respond. Try again in a moment.");
      }
      if (response.status === 503 || response.status === 429) {
        throw new AppError(503, "PDF_BUSY", "The PDF service is busy. Try again in a few seconds.");
      }
      const declared = Number(response.headers.get("content-length") ?? 0);
      if (!response.ok || !(response.headers.get("content-type") ?? "").startsWith("application/pdf") || declared > MAX_PDF_BYTES) {
        logger.error("PDF service returned an error", { status: response.status });
        throw new AppError(502, "PDF_RENDER_FAILED", "The PDF could not be generated. Try again; if it keeps failing, check the PDF service logs.");
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_PDF_BYTES || bytes.byteLength < 5) {
        throw new AppError(502, "PDF_RENDER_FAILED", "The PDF service returned an invalid document.");
      }
      return bytes;
    },
  };
}

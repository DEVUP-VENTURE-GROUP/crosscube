import puppeteer, { type Browser } from "puppeteer";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging/logger";
import type { InvoiceDocumentModel } from "./invoice-document-model";
import { PAGE_MARGIN, PAPER_DIMENSIONS } from "./invoice-document.css";
import { renderInvoiceHtml } from "./invoice-html";

export interface PdfRendererOptions {
  maxConcurrency: number;
  maxQueue: number;
  timeoutMs: number;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

export function pdfFileName(model: InvoiceDocumentModel): string {
  return `invoice-${model.invoiceLabel.replace(/[^A-Za-z0-9-]/g, "_").slice(0, 40)}.pdf`;
}

export class InvoicePdfRenderer {
  private browser: Promise<Browser> | null = null;
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly options: PdfRendererOptions) {}

  private getBrowser(): Promise<Browser> {
    if (!this.browser) {
      const launching = puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ["--disable-gpu", "--disable-dev-shm-usage", "--font-render-hinting=none"],
      });
      this.browser = launching;
      launching.then(
        (browser) => browser.on("disconnected", () => {
          if (this.browser === launching) this.browser = null;
        }),
        () => {
          if (this.browser === launching) this.browser = null;
        },
      );
    }
    return this.browser;
  }

  private async acquire(): Promise<void> {
    if (this.active < this.options.maxConcurrency) {
      this.active++;
      return;
    }
    if (this.waiting.length >= this.options.maxQueue) {
      throw new AppError(503, "PDF_BUSY", "The PDF service is busy. Try again in a few seconds.");
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) next();
    else this.active--;
  }

  async render(model: InvoiceDocumentModel): Promise<Uint8Array> {
    await this.acquire();
    const started = Date.now();
    let page: Awaited<ReturnType<Browser["newPage"]>> | null = null;
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();
      page.setDefaultTimeout(this.options.timeoutMs);
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        if (request.url().startsWith("data:") || request.url() === "about:blank") void request.continue();
        else void request.abort();
      });
      await page.setContent(await renderInvoiceHtml(model), { waitUntil: "load", timeout: this.options.timeoutMs });
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      const footer = `<div style="width:100%;font-family:Arial,Helvetica,sans-serif;font-size:7pt;color:#000;padding:0 ${PAGE_MARGIN.left};display:grid;grid-template-columns:1fr auto 1fr" data-label="${escapeHtml(model.invoiceLabel)}"><span></span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span><span></span></div>`;
      const pdf = await page.pdf({
        format: PAPER_DIMENSIONS[model.paperSize].pdfFormat,
        printBackground: true,
        margin: PAGE_MARGIN,
        displayHeaderFooter: true,
        headerTemplate: "<span></span>",
        footerTemplate: footer,
        timeout: this.options.timeoutMs,
      });
      logger.info("Invoice PDF rendered", { ms: Date.now() - started, bytes: pdf.byteLength });
      return pdf;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Invoice PDF render failed", { error: error instanceof Error ? error.message : "unknown" });
      throw new AppError(500, "PDF_RENDER_FAILED", "The PDF could not be generated. Try again; if it keeps failing, check the server logs.");
    } finally {
      await page?.close().catch(() => undefined);
      this.release();
    }
  }

  async close(): Promise<void> {
    const browser = await this.browser?.catch(() => null);
    this.browser = null;
    await browser?.close();
  }
}

const globalForPdf = globalThis as typeof globalThis & { __invoicePdfRenderer?: InvoicePdfRenderer };

export function pdfRenderer(options: PdfRendererOptions): InvoicePdfRenderer {
  globalForPdf.__invoicePdfRenderer ??= new InvoicePdfRenderer(options);
  return globalForPdf.__invoicePdfRenderer;
}

import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createPdfServer } from "../../services/pdf-server";
import { AppError } from "@/lib/errors/app-error";
import { DEMO_SETTINGS, demoDraft } from "@/modules/demo/demo-data";
import { computeInvoice } from "@/modules/invoices/invoice.compute";
import { buildInvoiceDocumentModel } from "@/modules/pdf/invoice-document-model";
import { InvoicePdfRenderer } from "@/modules/pdf/invoice-pdf.service";
import { remotePdfRenderer } from "@/modules/pdf/remote-pdf-renderer";
import { toBusinessSnapshot } from "@/modules/settings/settings.types";
import { demoLookup } from "../unit/fixtures";

const TOKEN = "integration-token-0123456789abcdef0123456789";
const renderer = new InvoicePdfRenderer({ maxConcurrency: 2, maxQueue: 10, timeoutMs: 30_000 });
const server = createPdfServer({ token: TOKEN, renderer });
let baseUrl = "";

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await renderer.close();
});

function model() {
  const draft = demoDraft();
  const computed = computeInvoice(draft, demoLookup(), { shopSuppliesInParts: true });
  return buildInvoiceDocumentModel(
    { ...draft, status: "FINALIZED", isDemo: false, invoiceNumber: "00042", finalizedAt: new Date().toISOString(), lines: computed.lines, totals: computed.totals, shopSuppliesInParts: true },
    toBusinessSnapshot(DEMO_SETTINGS),
    new Date(),
  );
}

const post = (body: string, headers: Record<string, string> = {}) =>
  fetch(`${baseUrl}/render`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...headers }, body });

describe("standalone PDF service", () => {
  it("renders the invoice through the remote client", async () => {
    const bytes = await remotePdfRenderer({ url: baseUrl, token: TOKEN, timeoutMs: 30_000 }).render(model());
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
    const task = getDocument({ data: bytes.slice() });
    const pdf = await task.promise;
    const text = (await (await pdf.getPage(1)).getTextContent()).items.map((item) => ("str" in item ? item.str : "")).join(" ");
    await task.destroy();
    expect(text).toContain("272.78");
    expect(text).toContain("Part Description");
  });

  it("rejects missing or wrong tokens", async () => {
    expect((await post(JSON.stringify({ model: model() }), { Authorization: "" })).status).toBe(401);
    expect((await post(JSON.stringify({ model: model() }), { Authorization: `Bearer ${TOKEN}x` })).status).toBe(401);
    await expect(remotePdfRenderer({ url: baseUrl, token: `${TOKEN}-wrong`, timeoutMs: 5000 }).render(model())).rejects.toBeInstanceOf(AppError);
  });

  it("validates the document and request shape", async () => {
    expect((await post(JSON.stringify({ model: { ...model(), extra: true } }))).status).toBe(400);
    expect((await post(JSON.stringify({ model: { ...model(), paperSize: "LEGAL" } }))).status).toBe(400);
    expect((await post("{not json")).status).toBe(400);
    expect((await post(JSON.stringify({ model: model() }), { "Content-Type": "text/plain" })).status).toBe(415);
    expect((await post(JSON.stringify({ model: { ...model(), notes: "x".repeat(2_100_000) } }))).status).toBe(413);
  });

  it("serves health checks and rejects other routes", async () => {
    expect(await (await fetch(`${baseUrl}/healthz`)).json()).toEqual({ ok: true });
    expect((await fetch(`${baseUrl}/render`)).status).toBe(405);
    expect((await fetch(`${baseUrl}/admin`)).status).toBe(404);
  });

  it("reports an unreachable service as a clear error", async () => {
    await expect(remotePdfRenderer({ url: "http://127.0.0.1:1", token: TOKEN, timeoutMs: 2000 }).render(model())).rejects.toMatchObject({
      code: "PDF_RENDER_FAILED",
    });
  });
});

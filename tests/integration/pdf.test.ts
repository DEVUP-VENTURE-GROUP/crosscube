import { mkdirSync, writeFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { DEMO_IDS, DEMO_SETTINGS, demoDraft } from "@/modules/demo/demo-data";
import { createDraft, finalizeInvoice } from "@/modules/invoices/invoice.service";
import type { Invoice } from "@/modules/invoices/invoice.types";
import { buildInvoiceDocumentModel } from "@/modules/pdf/invoice-document-model";
import { InvoicePdfRenderer, pdfFileName } from "@/modules/pdf/invoice-pdf.service";
import { toBusinessSnapshot } from "@/modules/settings/settings.types";
import { useTestDatabase } from "./helpers";

useTestDatabase();

const renderer = new InvoicePdfRenderer({ maxConcurrency: 2, maxQueue: 10, timeoutMs: 30_000 });
afterAll(() => renderer.close());

const OUT_DIR = "artifacts/pdf";
mkdirSync(OUT_DIR, { recursive: true });

interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PageText {
  width: number;
  height: number;
  items: TextItem[];
  text: string;
}

async function readPdf(bytes: Uint8Array): Promise<PageText[]> {
  const task = getDocument({ data: bytes.slice(), useSystemFonts: false });
  const pdf = await task.promise;
  const pages: PageText[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items
      .filter((item): item is typeof item & { str: string; transform: number[]; width: number; height: number } => "str" in item)
      .filter((item) => item.str.trim() !== "")
      .map((item) => ({ str: item.str, x: item.transform[4]!, y: item.transform[5]!, width: item.width, height: item.height }));
    pages.push({ width: viewport.width, height: viewport.height, items, text: items.map((item) => item.str).join(" ") });
  }
  await task.destroy();
  return pages;
}

function overlaps(a: TextItem, b: TextItem): boolean {
  return a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
}

function assertNoClippingOrOverlap(page: PageText) {
  for (const item of page.items) {
    expect(item.x, item.str).toBeGreaterThanOrEqual(0);
    expect(item.x + item.width, item.str).toBeLessThanOrEqual(page.width + 0.5);
    expect(item.y, item.str).toBeGreaterThanOrEqual(0);
    expect(item.y + item.height, item.str).toBeLessThanOrEqual(page.height + 0.5);
  }
  for (let i = 0; i < page.items.length; i++) {
    for (let j = i + 1; j < page.items.length; j++) {
      const a = page.items[i]!;
      const b = page.items[j]!;
      if (overlaps(a, b) && !/^(DRAFT|VOID)$/.test(a.str) && !/^(DRAFT|VOID)$/.test(b.str)) {
        throw new Error(`Overlapping text: "${a.str}" and "${b.str}"`);
      }
    }
  }
}

async function render(invoice: Invoice, name: string, paperSize: "LETTER" | "A4" = "LETTER") {
  const business = { ...(invoice.business ?? toBusinessSnapshot(DEMO_SETTINGS)), paperSize };
  const model = buildInvoiceDocumentModel(invoice, business, new Date("2026-03-13T12:00:00Z"));
  const bytes = await renderer.render(model);
  writeFileSync(`${OUT_DIR}/${name}.pdf`, bytes);
  return { bytes, model, pages: await readPdf(bytes) };
}

async function finalized(draft = demoDraft()) {
  draft.payments = [{ id: crypto.randomUUID(), method: "CARD", amountCents: 27_278, receivedAt: "2026-03-12", reference: "Visa 1234" }];
  return (await finalizeInvoice((await createDraft(crypto.randomUUID(), draft)).id)).invoice;
}

describe("invoice PDF", () => {
  it("renders the reference invoice on one Letter page with selectable, correct text", async () => {
    const invoice = await finalized();
    const { bytes, pages, model } = await render(invoice, "reference-letter");
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
    expect(pages).toHaveLength(1);
    expect(Math.round(pages[0]!.width)).toBe(612);
    expect(Math.round(pages[0]!.height)).toBe(792);
    for (const text of ["Part Description", "Labor Description", "Motor Oil EDGE 0W-20 Euro Car 1QT", "6.00", "15.60", "93.60", "Oil Filter Kit", "23.05", "Shop Supplies", "ENGINE OIL FILTER - Remove & Replace", "110.40", "Hazardous Materials", "134.15", "262.05", "10.73", "272.78", "$0.00", "Payments - Credit Card Visa 1234 - $272.78", "Org. Estimate", "Page 1 of 1"]) {
      expect(pages[0]!.text).toContain(text);
    }
    assertNoClippingOrOverlap(pages[0]!);
    expect(pdfFileName(model)).toBe(`invoice-${invoice.invoiceNumber}.pdf`);
  });

  it("renders A4 when configured", async () => {
    const { pages } = await render(await finalized(), "reference-a4", "A4");
    expect(Math.abs(pages[0]!.width - 595.28)).toBeLessThan(1);
    expect(Math.abs(pages[0]!.height - 841.89)).toBeLessThan(1);
    assertNoClippingOrOverlap(pages[0]!);
  });

  it("paginates long invoices with repeated table headers, page numbers and unclipped totals", async () => {
    const draft = demoDraft();
    const longNote = "Inspected drain plug and gasket; torqued to specification recorded by the technician. ".repeat(3);
    for (let i = 0; i < 45; i++) {
      draft.lines.push({ ...draft.lines[1]!, id: `part-${i}`, description: `Oil Filter Kit — bay ${i + 1} with an intentionally long description that must wrap cleanly`, notes: i % 5 === 0 ? longNote : "" });
    }
    for (let i = 0; i < 12; i++) {
      draft.lines.push({ ...draft.lines[3]!, id: `labor-${i}`, notes: longNote });
    }
    const invoice = (await finalizeInvoice((await createDraft(crypto.randomUUID(), draft)).id)).invoice;
    const { pages } = await render(invoice, "multi-page");
    expect(pages.length).toBeGreaterThan(1);
    pages.forEach((page, index) => {
      expect(page.text).toContain(`Page ${index + 1} of ${pages.length}`);
      assertNoClippingOrOverlap(page);
    });
    const pagesWithParts = pages.filter((page) => page.text.includes("Oil Filter Kit"));
    for (const page of pagesWithParts) expect(page.text).toContain("Part Description");
    const totalsPages = pages.filter((page) => page.text.includes("Bal Due:"));
    expect(totalsPages).toHaveLength(1);
    expect(totalsPages[0]).toBe(pages[pages.length - 1]);
    expect(totalsPages[0]!.text).toContain("SubTotal:");
  }, 60_000);

  it("wraps unbroken long words instead of overflowing", async () => {
    const draft = demoDraft();
    draft.lines[0]!.description = "X".repeat(180);
    draft.customer.name = "Y".repeat(110);
    const { pages } = await render(await finalized(draft), "long-words");
    pages.forEach(assertNoClippingOrOverlap);
  });

  it("watermarks a draft PDF and never finalizes it", async () => {
    const draft = await createDraft(crypto.randomUUID(), demoDraft());
    const { pages } = await render(draft, "draft");
    expect(pages[0]!.text).toContain("DRAFT");
    expect(draft.status).toBe("DRAFT");
  });

  it("renders the same text on repeated downloads", async () => {
    const invoice = await finalized();
    const a = await render(invoice, "repeat-a");
    const b = await render(invoice, "repeat-b");
    expect(a.pages.map((p) => p.text)).toEqual(b.pages.map((p) => p.text));
  });

  it("handles parallel renders within the concurrency limit", async () => {
    const invoice = await finalized();
    const model = buildInvoiceDocumentModel(invoice, invoice.business!, new Date());
    const results = await Promise.all(Array.from({ length: 6 }, () => renderer.render(model)));
    expect(results.every((bytes) => bytes.byteLength > 1000)).toBe(true);
  }, 60_000);

  it("rejects work beyond the queue limit instead of growing without bound", async () => {
    const tiny = new InvoicePdfRenderer({ maxConcurrency: 1, maxQueue: 1, timeoutMs: 30_000 });
    const invoice = await finalized();
    const model = buildInvoiceDocumentModel(invoice, invoice.business!, new Date());
    const results = await Promise.allSettled([tiny.render(model), tiny.render(model), tiny.render(model)]);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    await tiny.close();
  }, 60_000);

  it("shows hazardous materials and shop supplies as separate lines", async () => {
    const invoice = await finalized();
    const kinds = invoice.lines.map((line) => [line.catalogItemId, line.lineTotalCents]);
    expect(kinds).toContainEqual([DEMO_IDS.shopSupplies, 1750]);
    expect(kinds).toContainEqual([DEMO_IDS.hazmat, 1750]);
    expect(invoice.totals.subtotalCents).toBe(26_205);
  });
});

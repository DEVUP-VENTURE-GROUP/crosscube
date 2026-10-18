import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { computeInvoice } from "@/modules/invoices/invoice.compute";
import type { DocumentSource } from "@/modules/pdf/invoice-document-model";
import { buildInvoiceDocumentModel, describeVehicle, formatCalendarDate, formatDocumentQuantity } from "@/modules/pdf/invoice-document-model";
import { InvoiceDocument } from "@/modules/pdf/invoice-document";
import { DEMO_SETTINGS } from "@/modules/demo/demo-data";
import { toBusinessSnapshot } from "@/modules/settings/settings.types";
import { demoLookup, referenceDraft } from "./fixtures";

function source(overrides: Partial<DocumentSource> = {}): DocumentSource {
  const draft = referenceDraft();
  const computed = computeInvoice(draft, demoLookup(), { shopSuppliesInParts: true });
  return {
    status: "FINALIZED",
    isDemo: false,
    invoiceNumber: "22386",
    estimateNumber: "038518",
    originalEstimateCents: 27_278,
    serviceDate: "2026-10-14",
    finalizedAt: "2026-10-14T15:00:00.000Z",
    customer: { ...draft.customer, company: "Catodrive", name: "Pat Example", phoneLabel: "Office", customerNumber: "8654" },
    vehicle: { ...draft.vehicle, vin: "1M8GDM9AXKP042788", licensePlate: "ABC1234" },
    lines: computed.lines,
    totals: computed.totals,
    payments: draft.payments,
    notes: "",
    shopSuppliesInParts: true,
    ...overrides,
  };
}

const business = toBusinessSnapshot(DEMO_SETTINGS);
const printed = new Date("2026-10-14T16:00:00.000Z");
const model = () => buildInvoiceDocumentModel(source(), business, printed);

describe("invoice document model (reference layout)", () => {
  it("lists parts with Qty/Sale/Ext and shop supplies as an indented Ext-only row", () => {
    expect(model().partsRows.map((row) => [row.description, row.quantity, row.unitPrice, row.amount, row.feeOnly])).toEqual([
      ["Motor Oil EDGE 0W-20 Euro Car 1QT", "6.00", "15.60", "93.60", false],
      ["Oil Filter Kit", "1.00", "23.05", "23.05", false],
      ["Shop Supplies", "", "", "17.50", true],
    ]);
  });

  it("puts labor with its notes and hazardous materials in the labor column", () => {
    const rows = model().laborRows;
    expect(rows.map((row) => [row.description, row.amount])).toEqual([
      ["ENGINE OIL FILTER - Remove & Replace", "110.40"],
      ["Hazardous Materials", "17.50"],
    ]);
    expect(rows[0]!.notes).toContain("Fluid Capacity:");
  });

  it("builds the totals box like the reference", () => {
    expect(model().documentTotals).toEqual([
      { label: "Labor:", amount: "110.40" },
      { label: "Parts:", amount: "134.15" },
      { label: "HazMat:", amount: "17.50", gapBefore: true },
      { label: "SubTotal:", amount: "262.05", ruleAbove: true, gapBefore: true },
      { label: "Tax:", amount: "10.73" },
      { label: "Total:", amount: "272.78", ruleAbove: true },
      { label: "Bal Due:", amount: "$0.00" },
    ]);
  });

  it("shows partial payments before the balance", () => {
    const partial = buildInvoiceDocumentModel(source({ totals: { ...source().totals, paymentsCents: 10_000, balanceCents: 17_278 } }), business, printed);
    expect(partial.documentTotals.slice(-2)).toEqual([
      { label: "Paid:", amount: "100.00" },
      { label: "Bal Due:", amount: "$172.78" },
    ]);
  });

  it("formats header, customer and vehicle blocks", () => {
    const m = model();
    expect(m.invoiceLabel).toBe("22386");
    expect(m.estimateNumber).toBe("038518");
    expect(m.printedDate).toBe("10/14/2026");
    expect(m.customerHeading).toBe("CATODRIVE - PAT EXAMPLE");
    expect(m.customerPhone).toBe("Office  (555) 010-1234");
    expect(m.customerNumber).toBe("8654");
    expect(m.vehicleDescription).toBe("2024 Volkswagen - Atlas SEL - 2L, In-Line4 (121CI)");
    expect([m.vinStart, m.vinEnd]).toEqual(["1M8GDM9AX", "KP042788"]);
    expect(m.licensePlate).toBe("ABC1234");
    expect(m.odometer).toBe("5132");
    expect(m.vehicleReceived).toBe("10/14/2026");
  });

  it("summarizes estimate revisions and payments", () => {
    expect(model().estimateSummary).toEqual({ original: "272.78", revisions: "0.00", current: "272.78" });
    expect(buildInvoiceDocumentModel(source({ originalEstimateCents: 25_000 }), business, printed).estimateSummary?.revisions).toBe("22.78");
    expect(buildInvoiceDocumentModel(source({ originalEstimateCents: null }), business, printed).estimateSummary).toBeNull();
    expect(model().paymentSummary).toBe("Payments - Credit Card - $272.78");
  });

  it("watermarks drafts and void invoices", () => {
    expect(buildInvoiceDocumentModel(source({ status: "DRAFT", invoiceNumber: null, finalizedAt: null }), business, printed)).toMatchObject({
      watermark: "DRAFT",
      invoiceLabel: "DRAFT",
    });
    expect(buildInvoiceDocumentModel(source({ status: "VOID" }), business, printed).watermark).toBe("VOID");
  });

  it("escapes user-entered text in the rendered document", () => {
    const evil = source({ customer: { ...source().customer, name: '<script>alert("x")</script>' } });
    const html = renderToStaticMarkup(createElement(InvoiceDocument, { model: buildInvoiceDocumentModel(evil, business, printed) }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;SCRIPT&gt;");
  });

  it("prints authorization and warranty text only when configured", () => {
    const html = renderToStaticMarkup(createElement(InvoiceDocument, { model: model() }));
    expect(html).not.toContain("hereby authorize");
    expect(html).toContain("Signature");
    const withText = renderToStaticMarkup(
      createElement(InvoiceDocument, { model: buildInvoiceDocumentModel(source(), { ...business, authorizationText: "I hereby authorize the above repair work." }, printed) }),
    );
    expect(withText).toContain("I hereby authorize the above repair work.");
  });

  it("formats helpers", () => {
    expect(formatCalendarDate("2026-01-01")).toBe("01/01/2026");
    expect(formatCalendarDate("")).toBe("");
    expect(formatDocumentQuantity(6000)).toBe("6.00");
    expect(formatDocumentQuantity(1250)).toBe("1.25");
    expect(formatDocumentQuantity(1255)).toBe("1.255");
    expect(formatDocumentQuantity(1500)).toBe("1.50");
    expect(describeVehicle({ ...source().vehicle, trim: "", engine: "" })).toBe("2024 Volkswagen - Atlas");
  });
});

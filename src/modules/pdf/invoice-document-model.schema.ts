import { z } from "zod";
import { PAPER_SIZES, settingsInputSchema } from "@/modules/settings/settings.types";
import type { InvoiceDocumentModel } from "./invoice-document-model";

const text = (max = 4000) => z.string().max(max);
const rows = <T extends z.ZodTypeAny>(row: T) => z.array(row).max(500);

// Validates documents arriving at the standalone PDF service; business fields reuse the settings schema.
export const invoiceDocumentModelSchema = z
  .object({
    watermark: z.enum(["DRAFT", "VOID"]).nullable(),
    demoNotice: z.boolean(),
    paperSize: z.enum(PAPER_SIZES),
    business: settingsInputSchema.omit({ invoiceNumberPrefix: true, invoiceNumberPad: true }).strip(),
    businessAddress: rows(text(200)),
    businessContact: text(200),
    invoiceLabel: text(60),
    estimateNumber: text(60),
    printedDate: text(20),
    customerHeading: text(300),
    customerAddress: rows(text(200)),
    customerPhone: text(80),
    customerEmail: text(254),
    customerNumber: text(40),
    vehicleDescription: text(300),
    licensePlate: text(40),
    odometer: text(20),
    vinStart: text(40),
    vinEnd: text(40),
    vehicleReceived: text(20),
    partsRows: rows(
      z.object({
        key: text(80),
        description: text(),
        sku: text(80),
        notes: text(),
        quantity: text(20),
        unitPrice: text(30),
        amount: text(30),
        feeOnly: z.boolean(),
      }),
    ),
    laborRows: rows(z.object({ key: text(80), description: text(), notes: text(), detail: text(200), amount: text(30) })),
    estimateSummary: z.object({ original: text(30), revisions: text(30), current: text(30) }).nullable(),
    paymentSummary: text(),
    documentTotals: rows(z.object({ label: text(60), amount: text(30), ruleAbove: z.boolean().optional(), gapBefore: z.boolean().optional() })),
    totalRows: rows(z.object({ label: text(120), amount: text(30), strong: z.boolean().optional() })),
    notes: text(),
  })
  .strict() satisfies z.ZodType<InvoiceDocumentModel, z.ZodTypeDef, unknown>;

import { z } from "zod";
import { MAX_QUANTITY_MILLI, MAX_UNIT_PRICE_CENTS, MAX_LINE_TOTAL_CENTS } from "@/lib/money/money";
import { idSchema } from "@/modules/catalog/catalog.validation";
import { LINE_KINDS } from "@/modules/pricing/pricing.types";
import { normalizeVin } from "@/modules/vehicles/vin";
import { PAYMENT_METHODS } from "./invoice.types";

export const MAX_LINES = 200;
export const MAX_PAYMENTS = 50;

const text = (max: number) => z.string().trim().max(max).default("");

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export const calendarDateSchema = z.string().refine(isCalendarDate, "Use a valid date (YYYY-MM-DD)");

export const customerSnapshotSchema = z
  .object({
    name: text(120),
    company: text(120),
    customerNumber: text(20),
    phoneLabel: z.string().trim().max(16).default("Phone"),
    phone: text(40),
    email: text(254).refine((v) => v === "" || z.string().email().safeParse(v).success, "Invalid email address"),
    addressLine1: text(120),
    addressLine2: text(120),
    city: text(80),
    state: text(40),
    postalCode: text(20),
  })
  .strict();

export const vehicleSnapshotSchema = z
  .object({
    year: z.number().int().min(1900).max(2100).nullable().default(null),
    make: text(60),
    model: text(60),
    trim: text(60),
    engine: text(80),
    vin: z.string().max(40).default("").transform(normalizeVin),
    licensePlate: z.string().trim().max(16).default("").transform((v) => v.toUpperCase()),
    odometer: z.number().int().min(0).max(9_999_999).nullable().default(null),
    notes: text(2000),
  })
  .strict();

export const lineInputSchema = z
  .object({
    id: idSchema,
    catalogItemId: idSchema,
    kind: z.enum(LINE_KINDS),
    description: z.string().trim().min(1, "Description is required").max(2000),
    notes: text(4000),
    quantityMilli: z.number().int().min(1).max(MAX_QUANTITY_MILLI),
    unitPriceCents: z.number().int().min(0).max(MAX_UNIT_PRICE_CENTS),
    priceOverrideReason: text(300),
  })
  .strip();

export const paymentInputSchema = z
  .object({
    id: idSchema,
    method: z.enum(PAYMENT_METHODS),
    amountCents: z.number().int().min(1).max(MAX_LINE_TOTAL_CENTS * 10),
    receivedAt: calendarDateSchema,
    reference: text(80),
  })
  .strict();

export const draftInputSchema = z
  .object({
    customerId: idSchema.nullable().default(null),
    vehicleId: idSchema.nullable().default(null),
    customer: customerSnapshotSchema,
    vehicle: vehicleSnapshotSchema,
    estimateNumber: text(40),
    originalEstimateCents: z.number().int().min(0).max(1_000_000_000).nullable().default(null),
    serviceDate: z.union([z.literal(""), calendarDateSchema]).default(""),
    notes: text(4000),
    lines: z.array(lineInputSchema).max(MAX_LINES, `An invoice can have at most ${MAX_LINES} lines`),
    payments: z.array(paymentInputSchema).max(MAX_PAYMENTS),
  })
  .strict();

export type DraftInput = z.infer<typeof draftInputSchema>;
export type LineInput = z.infer<typeof lineInputSchema>;

export const saveDraftRequestSchema = z.object({ version: z.number().int().min(1), draft: draftInputSchema }).strict();
export const createDraftRequestSchema = z
  .object({ idempotencyKey: z.string().regex(/^[A-Za-z0-9-]{8,64}$/), draft: draftInputSchema.optional() })
  .strict();
export const voidRequestSchema = z.object({ reason: z.string().trim().min(3, "A reason is required").max(500) }).strict();
export const recordPaymentRequestSchema = z.object({ version: z.number().int().min(1), payment: paymentInputSchema }).strict();

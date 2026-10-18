import { z } from "zod";
import { MAX_QUANTITY_MILLI, MAX_RATE_PPM, MAX_UNIT_PRICE_CENTS } from "@/lib/money/money";
import { LINE_KINDS } from "@/modules/pricing/pricing.types";

export const idSchema = z.string().regex(/^[A-Za-z0-9-]{1,64}$/, "Invalid id");

const trimmed = (max: number) => z.string().trim().max(max);

export const catalogItemInputSchema = z
  .object({
    kind: z.enum(LINE_KINDS),
    name: trimmed(200).min(1, "Name is required"),
    invoiceDescription: trimmed(2000).default(""),
    sku: trimmed(64)
      .nullable()
      .default(null)
      .transform((value) => (value ? value.toUpperCase() : null)),
    category: trimmed(80).default(""),
    unit: trimmed(16).min(1, "Unit is required"),
    defaultQuantityMilli: z.number().int().min(1).max(MAX_QUANTITY_MILLI).default(1000),
    unitPriceCents: z.number().int().min(0).max(MAX_UNIT_PRICE_CENTS),
    taxCategoryId: idSchema.nullable().default(null),
    keywords: z.array(trimmed(40).min(1)).max(30).default([]),
    active: z.boolean().default(true),
    priceEditable: z.boolean().default(false),
    quantityEditable: z.boolean().default(true),
    associatedLaborId: idSchema.nullable().default(null),
  })
  .strict();

export type CatalogItemInput = z.infer<typeof catalogItemInputSchema>;

export const taxCategoryInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Z0-9_]{2,32}$/, "Code must be 2-32 uppercase letters, digits or underscores"),
    name: trimmed(80).min(1, "Name is required"),
    ratePpm: z.number().int().min(0).max(MAX_RATE_PPM),
    active: z.boolean().default(true),
  })
  .strict();

export type TaxCategoryInput = z.infer<typeof taxCategoryInputSchema>;

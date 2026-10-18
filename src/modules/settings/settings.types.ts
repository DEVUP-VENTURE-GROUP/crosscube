import { z } from "zod";

export const PAPER_SIZES = ["LETTER", "A4"] as const;
export type PaperSize = (typeof PAPER_SIZES)[number];

const text = (max: number) => z.string().trim().max(max);

function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export const MAX_LOGO_DATA_URL_LENGTH = 400_000;

export const settingsInputSchema = z
  .object({
    businessName: text(120).min(1, "Business name is required"),
    addressLine1: text(120).min(1, "Street address is required"),
    addressLine2: text(120),
    city: text(80).min(1, "City is required"),
    state: text(40).min(1, "State is required"),
    postalCode: text(20).min(1, "ZIP is required"),
    phone: text(40).min(1, "Phone is required"),
    fax: text(40),
    organizationNumber: text(30),
    website: text(200),
    email: text(254).refine((v) => v === "" || z.string().email().safeParse(v).success, "Invalid email"),
    logoDataUrl: z
      .string()
      .max(MAX_LOGO_DATA_URL_LENGTH, "Logo must be smaller than about 290 KB")
      .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/, "Logo must be a PNG or JPEG image")
      .nullable(),
    invoiceTitle: text(40).min(1),
    invoiceNumberPrefix: z.string().trim().regex(/^[A-Za-z0-9-]{0,12}$/, "Prefix may only contain letters, digits and dashes"),
    invoiceNumberPad: z.number().int().min(1).max(10),
    paperSize: z.enum(PAPER_SIZES),
    timeZone: z.string().trim().min(1).refine(isValidTimeZone, "Unknown time zone"),
    shopSuppliesInParts: z.boolean(),
    authorizationText: text(3000),
    warrantyText: text(3000),
    footerNote: text(500),
    showSignatureLines: z.boolean(),
  })
  .strict();

export type ShopSettingsInput = z.infer<typeof settingsInputSchema>;

export interface ShopSettings extends ShopSettingsInput {
  nextInvoiceNumber: number;
  updatedAt: string | null;
}

export type BusinessSnapshot = Omit<ShopSettingsInput, "invoiceNumberPrefix" | "invoiceNumberPad">;

export const DEFAULT_SETTINGS: ShopSettingsInput = {
  businessName: "Your Business Name",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  phone: "",
  fax: "",
  organizationNumber: "",
  website: "",
  email: "",
  logoDataUrl: null,
  invoiceTitle: "Invoice",
  invoiceNumberPrefix: "",
  invoiceNumberPad: 5,
  paperSize: "LETTER",
  timeZone: "America/New_York",
  shopSuppliesInParts: true,
  authorizationText: "",
  warrantyText: "",
  footerNote: "",
  showSignatureLines: true,
};

export function toBusinessSnapshot(settings: ShopSettingsInput): BusinessSnapshot {
  const { invoiceNumberPrefix: _prefix, invoiceNumberPad: _pad, ...business } = settings;
  return business;
}

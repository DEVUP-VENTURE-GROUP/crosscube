import type { Cents, QuantityMilli } from "@/lib/money/money";
import type { InvoiceTotals, LineKind, TaxSnapshot } from "@/modules/pricing/pricing.types";
import type { BusinessSnapshot } from "@/modules/settings/settings.types";

export const INVOICE_STATUSES = ["DRAFT", "FINALIZING", "FINALIZED", "VOID"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = ["CASH", "CARD", "CHECK", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface CustomerSnapshot {
  name: string;
  company: string;
  customerNumber: string;
  phoneLabel: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface VehicleSnapshot {
  year: number | null;
  make: string;
  model: string;
  trim: string;
  engine: string;
  vin: string;
  licensePlate: string;
  odometer: number | null;
  notes: string;
}

export interface InvoiceLine {
  id: string;
  catalogItemId: string | null;
  kind: LineKind;
  sku: string;
  description: string;
  notes: string;
  unit: string;
  quantityMilli: QuantityMilli;
  unitPriceCents: Cents;
  catalogUnitPriceCents: Cents | null;
  priceOverrideReason: string;
  tax: TaxSnapshot | null;
  lineTotalCents: Cents;
}

export interface Payment {
  id: string;
  method: PaymentMethod;
  amountCents: Cents;
  receivedAt: string;
  reference: string;
}

export interface InvoiceEvent {
  type: "CREATED" | "FINALIZED" | "PRICE_OVERRIDE" | "PAYMENT_RECORDED" | "PAYMENT_REMOVED" | "VOIDED" | "REISSUED_FROM";
  at: string;
  details: Record<string, string | number | null>;
}

export interface Invoice {
  id: string;
  status: InvoiceStatus;
  invoiceNumber: string | null;
  sequenceNumber: number | null;
  version: number;
  isDemo: boolean;
  estimateNumber: string;
  originalEstimateCents: Cents | null;
  serviceDate: string;
  customerId: string | null;
  vehicleId: string | null;
  customer: CustomerSnapshot;
  vehicle: VehicleSnapshot;
  business: BusinessSnapshot | null;
  notes: string;
  shopSuppliesInParts: boolean;
  lines: InvoiceLine[];
  payments: Payment[];
  totals: InvoiceTotals;
  revisionOfId: string | null;
  voidReason: string;
  events: InvoiceEvent[];
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  voidedAt: string | null;
}

export interface InvoiceSummary {
  id: string;
  status: InvoiceStatus;
  invoiceNumber: string | null;
  isDemo: boolean;
  customerName: string;
  vehicleLabel: string;
  totalCents: Cents;
  balanceCents: Cents;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
}

export interface Issue {
  severity: "error" | "warning";
  path: string;
  message: string;
  code?: "REQUIRED";
}

export const EMPTY_CUSTOMER: CustomerSnapshot = {
  name: "",
  company: "",
  customerNumber: "",
  phoneLabel: "Phone",
  phone: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
};

export const EMPTY_VEHICLE: VehicleSnapshot = {
  year: null,
  make: "",
  model: "",
  trim: "",
  engine: "",
  vin: "",
  licensePlate: "",
  odometer: null,
  notes: "",
};

export function vehicleLabel(vehicle: VehicleSnapshot): string {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");
}

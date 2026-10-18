import { formatCents, formatRatePpm, QUANTITY_SCALE } from "@/lib/money/money";
import { lineSection } from "@/modules/pricing/pricing.service";
import type { InvoiceTotals } from "@/modules/pricing/pricing.types";
import type { Invoice, PaymentMethod, VehicleSnapshot } from "@/modules/invoices/invoice.types";
import type { BusinessSnapshot, PaperSize } from "@/modules/settings/settings.types";

export type DocumentSource = Pick<
  Invoice,
  | "status"
  | "isDemo"
  | "invoiceNumber"
  | "estimateNumber"
  | "originalEstimateCents"
  | "serviceDate"
  | "finalizedAt"
  | "customer"
  | "vehicle"
  | "lines"
  | "totals"
  | "payments"
  | "notes"
  | "shopSuppliesInParts"
>;

export interface PartRow {
  key: string;
  description: string;
  sku: string;
  notes: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  feeOnly: boolean;
}

export interface LaborRow {
  key: string;
  description: string;
  notes: string;
  detail: string;
  amount: string;
}

export interface TotalRow {
  label: string;
  amount: string;
  strong?: boolean;
}

export interface DocumentTotalRow {
  label: string;
  amount: string;
  ruleAbove?: boolean;
  gapBefore?: boolean;
}

export interface InvoiceDocumentModel {
  watermark: "DRAFT" | "VOID" | null;
  demoNotice: boolean;
  paperSize: PaperSize;
  business: BusinessSnapshot;
  businessAddress: string[];
  businessContact: string;
  invoiceLabel: string;
  estimateNumber: string;
  printedDate: string;
  customerHeading: string;
  customerAddress: string[];
  customerPhone: string;
  customerEmail: string;
  customerNumber: string;
  vehicleDescription: string;
  licensePlate: string;
  odometer: string;
  vinStart: string;
  vinEnd: string;
  vehicleReceived: string;
  partsRows: PartRow[];
  laborRows: LaborRow[];
  estimateSummary: { original: string; revisions: string; current: string } | null;
  paymentSummary: string;
  documentTotals: DocumentTotalRow[];
  totalRows: TotalRow[];
  notes: string;
}

const METHOD_LABELS: Record<PaymentMethod, string> = { CASH: "Cash", CARD: "Credit Card", CHECK: "Check", OTHER: "Other" };

export function formatCalendarDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[2]}/${match[3]}/${match[1]}` : "";
}

export function formatInstantDate(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

export function formatDocumentQuantity(quantityMilli: number): string {
  const decimals = quantityMilli % 10 === 0 ? 2 : 3;
  const whole = Math.trunc(quantityMilli / QUANTITY_SCALE);
  const fraction = String(quantityMilli % QUANTITY_SCALE).padStart(3, "0").slice(0, decimals);
  return `${whole}.${fraction}`;
}

const plain = (cents: number) => formatCents(cents, { symbol: false });

export function describeVehicle(vehicle: VehicleSnapshot): string {
  const head = [vehicle.year, vehicle.make].filter(Boolean).join(" ");
  const model = [vehicle.model, vehicle.trim].filter(Boolean).join(" ");
  return [head, model, vehicle.engine].filter(Boolean).join(" - ");
}

export function buildTotalRows(totals: InvoiceTotals): TotalRow[] {
  const rows: TotalRow[] = [
    { label: "Labor", amount: formatCents(totals.laborCents) },
    { label: "Parts", amount: formatCents(totals.partsCents) },
  ];
  if (totals.shopSuppliesCents) rows.push({ label: "Shop Supplies", amount: formatCents(totals.shopSuppliesCents) });
  if (totals.hazmatCents) rows.push({ label: "Hazardous Materials", amount: formatCents(totals.hazmatCents) });
  if (totals.otherFeesCents) rows.push({ label: "Other Charges", amount: formatCents(totals.otherFeesCents) });
  rows.push({ label: "Subtotal", amount: formatCents(totals.subtotalCents), strong: true });
  if (totals.taxLines.length === 0) rows.push({ label: "Tax", amount: formatCents(0) });
  for (const tax of totals.taxLines) {
    rows.push({ label: `${tax.name} (${formatRatePpm(tax.ratePpm)})`, amount: formatCents(tax.taxCents) });
  }
  rows.push({ label: "Total", amount: formatCents(totals.totalCents), strong: true });
  rows.push({ label: "Payments", amount: formatCents(totals.paymentsCents) });
  rows.push({ label: "Balance Due", amount: formatCents(totals.balanceCents), strong: true });
  return rows;
}

function documentTotals(totals: InvoiceTotals): DocumentTotalRow[] {
  const rows: DocumentTotalRow[] = [
    { label: "Labor:", amount: plain(totals.laborCents) },
    { label: "Parts:", amount: plain(totals.partsCents) },
  ];
  const fees: DocumentTotalRow[] = [];
  if (totals.shopSuppliesCents) fees.push({ label: "Shop Supplies:", amount: plain(totals.shopSuppliesCents) });
  if (totals.hazmatCents) fees.push({ label: "HazMat:", amount: plain(totals.hazmatCents) });
  if (totals.otherFeesCents) fees.push({ label: "Other:", amount: plain(totals.otherFeesCents) });
  if (fees[0]) fees[0].gapBefore = true;
  rows.push(...fees);
  rows.push({ label: "SubTotal:", amount: plain(totals.subtotalCents), ruleAbove: true, gapBefore: true });
  if (totals.taxLines.length === 0) rows.push({ label: "Tax:", amount: plain(0) });
  for (const tax of totals.taxLines) rows.push({ label: totals.taxLines.length > 1 ? `${tax.name}:` : "Tax:", amount: plain(tax.taxCents) });
  rows.push({ label: "Total:", amount: plain(totals.totalCents), ruleAbove: true });
  if (totals.paymentsCents && totals.balanceCents) rows.push({ label: "Paid:", amount: plain(totals.paymentsCents) });
  rows.push({ label: "Bal Due:", amount: formatCents(totals.balanceCents) });
  return rows;
}

export function buildInvoiceDocumentModel(source: DocumentSource, business: BusinessSnapshot, printedAt: Date): InvoiceDocumentModel {
  const options = { shopSuppliesInParts: source.shopSuppliesInParts };
  const isFinal = source.status === "FINALIZED" || source.status === "VOID";

  const c = source.customer;
  const cityLine = [c.city, [c.state, c.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const vin = source.vehicle.vin;

  const partsRows: PartRow[] = [];
  const laborRows: LaborRow[] = [];
  for (const line of source.lines) {
    const amount = plain(line.lineTotalCents);
    if (lineSection(line.kind, options) === "PARTS") {
      const feeOnly = line.kind !== "PART" && line.quantityMilli === QUANTITY_SCALE;
      partsRows.push({
        key: line.id,
        description: line.description,
        sku: line.sku,
        notes: line.notes,
        quantity: feeOnly ? "" : formatDocumentQuantity(line.quantityMilli),
        unitPrice: feeOnly ? "" : plain(line.unitPriceCents),
        amount,
        feeOnly,
      });
    } else {
      const detail = line.quantityMilli === QUANTITY_SCALE ? "" : `${formatDocumentQuantity(line.quantityMilli)} ${line.unit} @ ${plain(line.unitPriceCents)}`;
      laborRows.push({ key: line.id, description: line.description, notes: line.notes, detail, amount });
    }
  }

  const original = source.originalEstimateCents ?? null;
  const b = business;
  const businessCity = [b.city, [b.state, b.postalCode].filter(Boolean).join("  ")].filter(Boolean).join(", ");
  return {
    watermark: source.status === "VOID" ? "VOID" : isFinal ? null : "DRAFT",
    demoNotice: source.isDemo,
    paperSize: b.paperSize,
    business: b,
    businessAddress: [b.addressLine1, b.addressLine2, businessCity].filter(Boolean),
    businessContact: [b.phone && `Phone: ${b.phone}`, b.fax && `Fax: ${b.fax}`].filter(Boolean).join("   "),
    invoiceLabel: isFinal && source.invoiceNumber ? source.invoiceNumber : "DRAFT",
    estimateNumber: source.estimateNumber || b.organizationNumber || "",
    printedDate: formatInstantDate(printedAt, b.timeZone),
    customerHeading: [c.company, c.name].filter(Boolean).join(" - ").toUpperCase(),
    customerAddress: [c.addressLine1, c.addressLine2, cityLine].filter(Boolean),
    customerPhone: c.phone ? `${c.phoneLabel || "Phone"}  ${c.phone}` : "",
    customerEmail: c.email,
    customerNumber: c.customerNumber ?? "",
    vehicleDescription: describeVehicle(source.vehicle),
    licensePlate: source.vehicle.licensePlate,
    odometer: source.vehicle.odometer === null ? "" : String(source.vehicle.odometer),
    vinStart: vin.length > 8 ? vin.slice(0, -8) : "",
    vinEnd: vin.length > 8 ? vin.slice(-8) : vin,
    vehicleReceived: formatCalendarDate(source.serviceDate),
    partsRows,
    laborRows,
    estimateSummary:
      original === null
        ? null
        : { original: plain(original), revisions: plain(source.totals.totalCents - original), current: plain(source.totals.totalCents) },
    paymentSummary: source.payments
      .map((p) => `Payments - ${METHOD_LABELS[p.method]}${p.reference ? ` ${p.reference}` : ""} - ${formatCents(p.amountCents)}`)
      .join("   "),
    documentTotals: documentTotals(source.totals),
    totalRows: buildTotalRows(source.totals),
    notes: source.notes,
  };
}

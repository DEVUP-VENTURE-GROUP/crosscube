import type { CatalogItemInput, TaxCategoryInput } from "@/modules/catalog/catalog.validation";
import type { DraftInput } from "@/modules/invoices/invoice.validation";
import type { ShopSettingsInput } from "@/modules/settings/settings.types";
import { DEFAULT_SETTINGS } from "@/modules/settings/settings.types";

// Values transcribed from the reference invoice for demonstration only; they are not verified supplier prices or tax rates.
export const DEMO_TAX_CATEGORY: TaxCategoryInput & { id: string } = {
  id: "demo-tax-parts",
  code: "PARTS",
  name: "Sales Tax",
  ratePpm: 80_000,
  active: true,
};

export const DEMO_IDS = {
  motorOil: "demo-motor-oil-edge-0w20",
  oilFilterKit: "demo-oil-filter-kit",
  shopSupplies: "demo-shop-supplies",
  oilChangeLabor: "demo-labor-oil-filter",
  hazmat: "demo-hazmat",
} as const;

export const DEMO_CATALOG: (CatalogItemInput & { id: string })[] = [
  {
    id: DEMO_IDS.oilChangeLabor,
    kind: "LABOR",
    name: "ENGINE OIL FILTER - Remove & Replace",
    invoiceDescription: "ENGINE OIL FILTER - Remove & Replace",
    sku: null,
    category: "Maintenance",
    unit: "JOB",
    defaultQuantityMilli: 1000,
    unitPriceCents: 11_040,
    taxCategoryId: null,
    keywords: ["oil change", "lube", "oil service"],
    active: true,
    priceEditable: true,
    quantityEditable: true,
    associatedLaborId: null,
  },
  {
    id: DEMO_IDS.motorOil,
    kind: "PART",
    name: "Motor Oil EDGE 0W-20 Euro Car 1QT",
    invoiceDescription: "Motor Oil EDGE 0W-20 Euro Car 1QT",
    sku: null,
    category: "Engine Oil",
    unit: "QT",
    defaultQuantityMilli: 1000,
    unitPriceCents: 1_560,
    taxCategoryId: DEMO_TAX_CATEGORY.id,
    keywords: ["engine oil", "synthetic", "0w20", "quart"],
    active: true,
    priceEditable: false,
    quantityEditable: true,
    associatedLaborId: DEMO_IDS.oilChangeLabor,
  },
  {
    id: DEMO_IDS.oilFilterKit,
    kind: "PART",
    name: "Oil Filter Kit",
    invoiceDescription: "Oil Filter Kit",
    sku: null,
    category: "Filters",
    unit: "EA",
    defaultQuantityMilli: 1000,
    unitPriceCents: 2_305,
    taxCategoryId: DEMO_TAX_CATEGORY.id,
    keywords: ["filter", "cartridge"],
    active: true,
    priceEditable: false,
    quantityEditable: true,
    associatedLaborId: DEMO_IDS.oilChangeLabor,
  },
  {
    id: DEMO_IDS.shopSupplies,
    kind: "SHOP_SUPPLIES",
    name: "Shop Supplies",
    invoiceDescription: "Shop Supplies",
    sku: null,
    category: "Fees",
    unit: "EA",
    defaultQuantityMilli: 1000,
    unitPriceCents: 1_750,
    taxCategoryId: DEMO_TAX_CATEGORY.id,
    keywords: ["supplies", "consumables"],
    active: true,
    priceEditable: false,
    quantityEditable: false,
    associatedLaborId: null,
  },
  {
    id: DEMO_IDS.hazmat,
    kind: "HAZMAT",
    name: "Hazardous Materials",
    invoiceDescription: "Hazardous Materials",
    sku: null,
    category: "Fees",
    unit: "EA",
    defaultQuantityMilli: 1000,
    unitPriceCents: 1_750,
    taxCategoryId: null,
    keywords: ["hazmat", "disposal", "environmental", "waste oil"],
    active: true,
    priceEditable: false,
    quantityEditable: false,
    associatedLaborId: null,
  },
];

// Copied from the operator's reference invoice for this demo vehicle only; confirm specifications for every real vehicle.
const DEMO_LABOR_NOTES =
  "Fluid Capacity:\nEngine Oil - Volume: 6.00 QTS. (5.67L) - VW 508 00 SAE 0W-20; w/Filter - (Note: Refer to Technical Bulletin 2012855 for engine oils meeting the required VW oil quality standards. Approximate capacity.)";

export const DEMO_SETTINGS: ShopSettingsInput = {
  ...DEFAULT_SETTINGS,
  businessName: "Demo Auto Repair (sample business)",
  addressLine1: "100 Example Street",
  city: "Sampletown",
  state: "ST",
  postalCode: "00000",
  phone: "(555) 010-0000",
  fax: "(555) 010-0001",
  website: "www.example.com",
  email: "service@example.com",
};

export function demoDraft(): DraftInput {
  return {
    customerId: null,
    vehicleId: null,
    customer: {
      name: "Demo Customer",
      company: "",
      customerNumber: "",
      phoneLabel: "Phone",
      phone: "(555) 010-1234",
      email: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
    },
    vehicle: {
      year: 2024,
      make: "Volkswagen",
      model: "Atlas",
      trim: "SEL",
      engine: "2L, In-Line4 (121CI)",
      vin: "",
      licensePlate: "",
      odometer: 5_132,
      notes: "",
    },
    estimateNumber: "DEMO-1",
    originalEstimateCents: 27_278,
    serviceDate: "2026-10-14",
    notes: "",
    lines: [
      line("demo-line-oil", DEMO_IDS.motorOil, "PART", "Motor Oil EDGE 0W-20 Euro Car 1QT", 6_000, 1_560),
      line("demo-line-filter", DEMO_IDS.oilFilterKit, "PART", "Oil Filter Kit", 1_000, 2_305),
      line("demo-line-supplies", DEMO_IDS.shopSupplies, "SHOP_SUPPLIES", "Shop Supplies", 1_000, 1_750),
      {
        ...line("demo-line-labor", DEMO_IDS.oilChangeLabor, "LABOR", "ENGINE OIL FILTER - Remove & Replace", 1_000, 11_040),
        notes: DEMO_LABOR_NOTES,
      },
      line("demo-line-hazmat", DEMO_IDS.hazmat, "HAZMAT", "Hazardous Materials", 1_000, 1_750),
    ],
    payments: [],
  };
}

function line(
  id: string,
  catalogItemId: string,
  kind: DraftInput["lines"][number]["kind"],
  description: string,
  quantityMilli: number,
  unitPriceCents: number,
): DraftInput["lines"][number] {
  return { id, catalogItemId, kind, description, notes: "", quantityMilli, unitPriceCents, priceOverrideReason: "" };
}

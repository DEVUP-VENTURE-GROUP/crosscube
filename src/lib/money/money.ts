export type Cents = number;
export type QuantityMilli = number;

export const QUANTITY_SCALE = 1000;
export const RATE_PPM_SCALE = 1_000_000;
export const MAX_QUANTITY_MILLI = 9_999_999;
export const MAX_UNIT_PRICE_CENTS = 10_000_000;
export const MAX_LINE_TOTAL_CENTS = 100_000_000;
export const MAX_INVOICE_TOTAL_CENTS = 1_000_000_000;
export const MAX_RATE_PPM = 500_000;

export function isCents(value: unknown): value is Cents {
  return typeof value === "number" && Number.isSafeInteger(value);
}

// Half-up rounding, applied symmetrically (away from zero) for negative values.
export function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError("denominator must be positive");
  const negative = numerator < 0n;
  const abs = negative ? -numerator : numerator;
  const quotient = (abs * 2n + denominator) / (denominator * 2n);
  return negative ? -quotient : quotient;
}

export function multiplyQuantity(quantityMilli: QuantityMilli, unitPriceCents: Cents): Cents {
  return Number(divRoundHalfUp(BigInt(quantityMilli) * BigInt(unitPriceCents), BigInt(QUANTITY_SCALE)));
}

export function applyRatePpm(baseCents: Cents, ratePpm: number): Cents {
  return Number(divRoundHalfUp(BigInt(baseCents) * BigInt(ratePpm), BigInt(RATE_PPM_SCALE)));
}

function parseScaledDecimal(input: string, scale: number, maxIntegerDigits: number): number | null {
  const cleaned = input.trim().replace(/^\$/, "").replace(/,/g, "");
  const match = new RegExp(`^(\\d{1,${maxIntegerDigits}})?(?:\\.(\\d*))?$`).exec(cleaned);
  if (!match || cleaned === "" || cleaned === ".") return null;
  const whole = match[1] ?? "0";
  const fraction = match[2] ?? "";
  if (fraction.length > scale) return null;
  const value = Number(whole) * 10 ** scale + Number(fraction.padEnd(scale, "0") || "0");
  return Number.isSafeInteger(value) ? value : null;
}

export function parseMoneyToCents(input: string): Cents | null {
  return parseScaledDecimal(input, 2, 9);
}

export function parseQuantityToMilli(input: string): QuantityMilli | null {
  return parseScaledDecimal(input, 3, 7);
}

export function parsePercentToPpm(input: string): number | null {
  return parseScaledDecimal(input.replace(/%$/, ""), 4, 3);
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatCents(cents: Cents, options: { symbol?: boolean } = {}): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = groupThousands(String(Math.trunc(abs / 100)));
  const fraction = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${options.symbol === false ? "" : "$"}${whole}.${fraction}`;
}

export function centsToInput(cents: Cents): string {
  const abs = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

function formatScaled(value: number, scale: number, decimals: number): string {
  const whole = Math.trunc(value / scale);
  const fraction = String(value % scale).padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

export function formatQuantity(quantityMilli: QuantityMilli): string {
  return formatScaled(quantityMilli, QUANTITY_SCALE, 3);
}

export function formatRatePpm(ratePpm: number): string {
  return `${formatScaled(ratePpm, 10_000, 4)}%`;
}

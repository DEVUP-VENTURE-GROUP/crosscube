export const MIN_GAP = 2;
export const MAX_GAP = 9;

export function formatInvoiceNumber(sequence: number, prefix: string, pad: number): string {
  return `${prefix}${String(sequence).padStart(pad, "0")}`;
}

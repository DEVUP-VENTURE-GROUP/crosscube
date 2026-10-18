export function formatInvoiceNumber(sequence: number, prefix: string, pad: number): string {
  return `${prefix}${String(sequence).padStart(pad, "0")}`;
}

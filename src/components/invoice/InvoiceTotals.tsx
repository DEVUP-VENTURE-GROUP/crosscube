import type { InvoiceTotals as Totals } from "@/modules/pricing/pricing.types";
import { buildTotalRows } from "@/modules/pdf/invoice-document-model";

export function InvoiceTotals({ totals }: { totals: Totals }) {
  return (
    <dl className="divide-y divide-zinc-100 text-sm" data-testid="invoice-totals">
      {buildTotalRows(totals).map((row) => (
        <div key={row.label} className={`flex justify-between gap-4 py-1.5 ${row.strong ? "font-semibold text-zinc-900" : "text-zinc-600"}`}>
          <dt>{row.label}</dt>
          <dd className="tabular-nums">{row.amount}</dd>
        </div>
      ))}
    </dl>
  );
}

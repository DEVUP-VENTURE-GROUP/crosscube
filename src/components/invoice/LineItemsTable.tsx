"use client";

import { Badge, Button, MoneyInput, QuantityInput, TextArea, TextInput } from "@/components/ui/controls";
import { formatCents } from "@/lib/money/money";
import type { CatalogItem } from "@/modules/catalog/catalog.types";
import type { InvoiceLine } from "@/modules/invoices/invoice.types";
import type { LineInput } from "@/modules/invoices/invoice.validation";
import { LINE_KIND_LABELS } from "@/modules/pricing/pricing.types";

export interface LineRow {
  index: number;
  input: LineInput;
  computed: InvoiceLine | undefined;
}

export function LineItemsTable({
  title,
  rows,
  catalog,
  errors,
  disabled,
  onChange,
  onRemove,
  emptyText,
}: {
  title: string;
  rows: LineRow[];
  catalog: ReadonlyMap<string, CatalogItem>;
  errors: Map<string, string>;
  disabled: boolean;
  onChange: (index: number, patch: Partial<LineInput>) => void;
  onRemove: (index: number) => void;
  emptyText: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">{title}</h3>
        <span className="text-xs text-zinc-500">
          {rows.length} {rows.length === 1 ? "line" : "lines"}
        </span>
      </div>
      <div className="hidden grid-cols-[minmax(0,1fr)_5.5rem_7rem_6rem_2.25rem] gap-2 border-b border-zinc-200 px-1 pb-1 text-[11px] font-medium tracking-wide text-zinc-500 uppercase sm:grid">
        <span>Description</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Unit price</span>
        <span className="text-right">Total</span>
        <span />
      </div>
      {rows.length === 0 && <p className="px-1 py-3 text-sm text-zinc-500">{emptyText}</p>}
      <ul className="divide-y divide-zinc-100">
        {rows.map(({ index, input, computed }) => {
          const item = catalog.get(input.catalogItemId);
          const path = `lines.${index}`;
          const catalogPrice = item?.unitPriceCents ?? null;
          const overridden = catalogPrice !== null && input.unitPriceCents !== catalogPrice;
          const rowErrors = [...errors.entries()].filter(([key]) => key === path || key.startsWith(`${path}.`)).map(([, message]) => message);
          return (
            <li key={input.id} className="px-1 py-2.5" data-testid="line-row">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_7rem_6rem_2.25rem] sm:items-start">
                <div className="col-span-2 min-w-0 sm:col-span-1">
                  <TextInput
                    aria-label="Description"
                    value={input.description}
                    maxLength={2000}
                    disabled={disabled}
                    onChange={(event) => onChange(index, { description: event.target.value })}
                  />
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                    <Badge tone={input.kind === "LABOR" ? "blue" : input.kind === "PART" ? "slate" : "amber"}>{LINE_KIND_LABELS[input.kind]}</Badge>
                    {item?.sku && <span>SKU {item.sku}</span>}
                    {item && <span>per {item.unit}</span>}
                    {computed?.tax ? <span>Taxable</span> : <span>Non-taxable</span>}
                    {item?.isDemo && <span className="text-amber-700">demo price</span>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:contents">
                  <QuantityInput
                    aria-label="Quantity"
                    value={input.quantityMilli}
                    disabled={disabled || item?.quantityEditable === false}
                    title={item?.quantityEditable === false ? "Quantity is fixed for this item" : undefined}
                    onCommit={(value) => value !== null && value > 0 && onChange(index, { quantityMilli: value })}
                  />
                  <MoneyInput
                    aria-label="Unit price"
                    value={input.unitPriceCents}
                    disabled={disabled || !item?.priceEditable}
                    title={item && !item.priceEditable ? "Price is set by the catalog" : undefined}
                    onCommit={(value) => value !== null && onChange(index, { unitPriceCents: value })}
                  />
                  <div className="flex h-9 items-center justify-end text-sm font-medium tabular-nums">{formatCents(computed?.lineTotalCents ?? 0)}</div>
                </div>
                <div className="col-start-2 row-start-1 flex justify-end sm:col-start-auto sm:row-start-auto">
                  <Button variant="ghost" className="h-9 w-9 px-0 text-zinc-500" aria-label={`Remove ${input.description}`} disabled={disabled} onClick={() => onRemove(index)}>
                    <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
                      <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </Button>
                </div>
              </div>

              {overridden && (
                <div className="mt-2 grid gap-2 rounded-md bg-amber-50 p-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <TextInput
                    aria-label="Reason for price change"
                    placeholder="Reason for price change (required)"
                    value={input.priceOverrideReason}
                    maxLength={300}
                    disabled={disabled}
                    invalid={errors.has(`${path}.priceOverrideReason`)}
                    onChange={(event) => onChange(index, { priceOverrideReason: event.target.value })}
                  />
                  <div className="flex items-center gap-2 text-xs text-amber-900">
                    Catalog {formatCents(catalogPrice!)}
                    <Button variant="ghost" className="h-7 px-2 text-xs" disabled={disabled} onClick={() => onChange(index, { unitPriceCents: catalogPrice!, priceOverrideReason: "" })}>
                      Use catalog price
                    </Button>
                  </div>
                </div>
              )}

              <details className="mt-1.5 text-sm" open={input.notes !== "" || undefined}>
                <summary className="cursor-pointer text-xs text-zinc-900 select-none">{input.notes ? "Service notes" : "Add service notes"}</summary>
                <TextArea
                  aria-label="Service notes"
                  className="mt-1.5"
                  rows={3}
                  maxLength={4000}
                  value={input.notes}
                  disabled={disabled}
                  placeholder="Work performed, findings, specifications confirmed for this vehicle…"
                  onChange={(event) => onChange(index, { notes: event.target.value })}
                />
              </details>

              {rowErrors.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-xs text-red-700">
                  {rowErrors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

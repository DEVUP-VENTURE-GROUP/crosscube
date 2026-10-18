"use client";

import { useMemo, useState } from "react";
import { ItemSearch } from "@/components/catalog/ItemSearch";
import { Alert, Button, Panel } from "@/components/ui/controls";
import { formatCents } from "@/lib/money/money";
import type { CatalogItem } from "@/modules/catalog/catalog.types";
import type { ComputedInvoice } from "@/modules/invoices/invoice.compute";
import type { LineInput } from "@/modules/invoices/invoice.validation";
import { lineSection } from "@/modules/pricing/pricing.service";
import { CustomerVehicleDetails } from "./CustomerVehicleDetails";
import { InvoiceTotals } from "./InvoiceTotals";
import { issueMap } from "./IssueList";
import { LineItemsTable, type LineRow } from "./LineItemsTable";
import type { ReferenceData } from "./types";
import type { useInvoiceDraft } from "./useInvoiceDraft";

const FEE_KINDS = new Set(["SHOP_SUPPLIES", "HAZMAT", "OTHER_FEE"]);

function newLine(item: CatalogItem): LineInput {
  return {
    id: crypto.randomUUID(),
    catalogItemId: item.id,
    kind: item.kind,
    description: item.invoiceDescription || item.name,
    notes: "",
    quantityMilli: item.defaultQuantityMilli,
    unitPriceCents: item.unitPriceCents,
    priceOverrideReason: "",
  };
}

export function InvoiceEditor({
  state,
  computed,
  reference,
  showRequired,
  onReview,
}: {
  state: ReturnType<typeof useInvoiceDraft>;
  computed: ComputedInvoice;
  reference: ReferenceData;
  showRequired: boolean;
  onReview: () => void;
}) {
  const { draft, update, editable, invoice } = state;
  const disabled = !editable;
  const catalogMap = useMemo(() => new Map(reference.catalog.map((item) => [item.id, item])), [reference.catalog]);
  const activeCatalog = useMemo(() => reference.catalog.filter((item) => item.active), [reference.catalog]);
  const fees = activeCatalog.filter((item) => FEE_KINDS.has(item.kind));
  const [notice, setNotice] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{ item: CatalogItem; labor: CatalogItem } | null>(null);

  const errors = useMemo(
    () => issueMap(computed.issues.filter((issue) => issue.severity === "error" && (showRequired || issue.code !== "REQUIRED"))),
    [computed.issues, showRequired],
  );
  const warnings = computed.issues.filter((issue) => issue.severity === "warning");
  const errorCount = computed.issues.filter((issue) => issue.severity === "error").length;

  const onCatalog = (id: string) => draft.lines.some((line) => line.catalogItemId === id);

  const addItem = (item: CatalogItem) => {
    if (FEE_KINDS.has(item.kind) && onCatalog(item.id)) {
      setNotice(`${item.name} is already on this invoice.`);
      return;
    }
    update((d) => ({ ...d, lines: [...d.lines, newLine(item)] }));
    setNotice(`Added ${item.name}.`);
    const labor = item.associatedLaborId ? catalogMap.get(item.associatedLaborId) : undefined;
    setSuggestion(labor && labor.active && !onCatalog(labor.id) ? { item, labor } : null);
  };

  const changeLine = (index: number, patch: Partial<LineInput>) =>
    update((d) => ({ ...d, lines: d.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)) }));
  const removeLine = (index: number) => update((d) => ({ ...d, lines: d.lines.filter((_, i) => i !== index) }));

  const options = { shopSuppliesInParts: reference.settings.shopSuppliesInParts };
  const rows: LineRow[] = draft.lines.map((input, index) => ({ index, input, computed: computed.lines[index] }));
  const partRows = rows.filter((row) => lineSection(row.computed?.kind ?? row.input.kind, options) === "PARTS");
  const laborRows = rows.filter((row) => lineSection(row.computed?.kind ?? row.input.kind, options) === "LABOR");

  return (
    <div className="space-y-4">
      {!editable && (
        <Alert tone="blue">
          Invoice {invoice.invoiceNumber} is {invoice.status === "VOID" ? "void" : "finalized"}; its items and prices are locked.
          {invoice.status === "FINALIZED" && " To correct it, void it on the Create Invoice tab and reissue a new draft."}
        </Alert>
      )}

      <Panel title="Customer & vehicle">
        <CustomerVehicleDetails draft={draft} update={update} errors={errors} disabled={disabled} />
      </Panel>

      <Panel title="Parts, labor & fees">
        <div className="space-y-4">
          <ItemSearch catalog={activeCatalog} onSelect={addItem} disabled={disabled} />

          {fees.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">Quick add:</span>
              {fees.map((fee) => (
                <Button key={fee.id} className="h-8 text-xs" disabled={disabled || onCatalog(fee.id)} onClick={() => addItem(fee)}>
                  + {fee.name} {formatCents(fee.unitPriceCents)}
                </Button>
              ))}
            </div>
          )}

          <div aria-live="polite" className="space-y-2">
            {suggestion && editable && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                <span>
                  Labor configured for {suggestion.item.name}: <strong>{suggestion.labor.name}</strong> ({formatCents(suggestion.labor.unitPriceCents)})
                </span>
                <span className="ml-auto flex gap-2">
                  <Button
                    variant="primary"
                    className="h-8 text-xs"
                    onClick={() => {
                      addItem(suggestion.labor);
                      setSuggestion(null);
                    }}
                  >
                    Add labor
                  </Button>
                  <Button variant="ghost" className="h-8 text-xs" onClick={() => setSuggestion(null)}>
                    Dismiss
                  </Button>
                </span>
              </div>
            )}
            {notice && <p className="text-xs text-slate-500">{notice}</p>}
          </div>

          <LineItemsTable
            title="Parts"
            rows={partRows}
            catalog={catalogMap}
            errors={errors}
            disabled={disabled}
            onChange={changeLine}
            onRemove={removeLine}
            emptyText="No parts yet. Search the catalog above."
          />
          <LineItemsTable
            title="Labor & fees"
            rows={laborRows}
            catalog={catalogMap}
            errors={errors}
            disabled={disabled}
            onChange={changeLine}
            onRemove={removeLine}
            emptyText="No labor or fees yet."
          />
          {(showRequired || draft.lines.length > 0) && errors.get("lines") && <p className="text-sm text-red-700">{errors.get("lines")}</p>}
        </div>
      </Panel>

      <Panel title="Totals">
        <InvoiceTotals totals={editable ? computed.totals : invoice.totals} />
        {editable && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-500">
              {errorCount > 0
                ? `${errorCount} ${errorCount === 1 ? "item needs" : "items need"} attention before finalizing.`
                : warnings.length > 0
                  ? `Ready to finalize · ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`
                  : "Ready to finalize."}
            </p>
            <Button variant="primary" onClick={onReview}>
              Review &amp; create invoice
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}

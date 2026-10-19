"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Checkbox, Panel, Select, TextInput } from "@/components/ui/controls";
import { api, ApiError } from "@/lib/http/client";
import { formatCents, formatQuantity, formatRatePpm } from "@/lib/money/money";
import { buildSearchIndex, searchCatalog } from "@/modules/catalog/catalog.search";
import type { CatalogItem, TaxCategory } from "@/modules/catalog/catalog.types";
import { LINE_KINDS, LINE_KIND_LABELS, type LineKind } from "@/modules/pricing/pricing.types";
import { CatalogItemForm } from "./CatalogItemForm";

export function CatalogManager() {
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<LineKind | "">("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | "new" | null>(null);

  useEffect(() => {
    Promise.all([api<{ items: CatalogItem[] }>("/api/catalog?includeInactive=1"), api<{ items: TaxCategory[] }>("/api/tax-categories")]).then(
      ([catalog, tax]) => {
        setItems(catalog.items);
        setTaxCategories(tax.items);
      },
      (e: unknown) => setError(e instanceof ApiError ? e.message : "Could not load the catalog."),
    );
  }, []);

  const index = useMemo(() => buildSearchIndex(items ?? []), [items]);
  const visible = useMemo(() => {
    const base = query.trim() ? searchCatalog(index, query, { limit: 500, includeInactive: true }) : (items ?? []);
    return base.filter((item) => (showInactive || item.active) && (!kind || item.kind === kind));
  }, [index, items, query, kind, showInactive]);
  const taxById = new Map(taxCategories.map((category) => [category.id, category]));

  const saved = (item: CatalogItem) => {
    setItems((current) => {
      const list = current ?? [];
      return list.some((existing) => existing.id === item.id) ? list.map((existing) => (existing.id === item.id ? item : existing)) : [...list, item];
    });
    setEditing(null);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Catalog</h1>
        <p className="text-sm text-zinc-500">Parts, labor operations, shop supplies, hazardous-material and other authorized charges.</p>
        <Button variant="primary" className="ml-auto" onClick={() => setEditing("new")}>
          New item
        </Button>
      </div>
      {error && <Alert>{error}</Alert>}

      {editing && (
        <div className="mb-4">
          <Panel title={editing === "new" ? "New catalog item" : `Edit ${editing.name}`}>
            <CatalogItemForm
              key={editing === "new" ? "new" : editing.id}
              item={editing === "new" ? null : editing}
              catalog={items ?? []}
              taxCategories={taxCategories}
              onSaved={saved}
              onCancel={() => setEditing(null)}
              onDeleted={(id) => {
                setItems((current) => (current ?? []).filter((existing) => existing.id !== id).map((existing) => (existing.associatedLaborId === id ? { ...existing, associatedLaborId: null } : existing)));
                setEditing(null);
              }}
            />
          </Panel>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-72">
          <TextInput type="search" aria-label="Search catalog" placeholder="Search name, SKU, keyword…" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <Select aria-label="Filter by type" className="w-auto" value={kind} onChange={(event) => setKind(event.target.value as LineKind | "")}>
          <option value="">All types</option>
          {LINE_KINDS.map((k) => (
            <option key={k} value={k}>
              {LINE_KIND_LABELS[k]}
            </option>
          ))}
        </Select>
        <Checkbox label="Show inactive" checked={showInactive} onChange={setShowInactive} />
      </div>

      <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium tracking-wide text-zinc-500 uppercase">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2 text-right">Default qty</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2">Tax</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items === null && !error && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                  Loading…
                </td>
              </tr>
            )}
            {items !== null && visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                  {items.length === 0 ? "The catalog is empty. Add your first item, or run npm run db:seed for demonstration data." : "No items match these filters."}
                </td>
              </tr>
            )}
            {visible.map((item) => {
              const tax = item.taxCategoryId ? taxById.get(item.taxCategoryId) : null;
              return (
                <tr key={item.id} className={item.active ? "" : "text-zinc-400"}>
                  <td className="px-3 py-2">
                    <span className="font-medium">{item.name}</span>
                    <span className="ml-2 inline-flex gap-1">
                      {!item.active && <Badge>inactive</Badge>}
                      {item.isDemo && <Badge tone="amber">demo</Badge>}
                    </span>
                  </td>
                  <td className="px-3 py-2">{LINE_KIND_LABELS[item.kind]}</td>
                  <td className="px-3 py-2 font-mono text-xs">{item.sku ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatQuantity(item.defaultQuantityMilli)} {item.unit}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCents(item.unitPriceCents)}</td>
                  <td className="px-3 py-2">{tax ? `${tax.name} ${formatRatePpm(tax.ratePpm)}` : "Non-taxable"}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" className="h-8 text-xs" onClick={() => setEditing(item)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}

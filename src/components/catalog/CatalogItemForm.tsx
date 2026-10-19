"use client";

import { useState } from "react";
import { Alert, Button, Checkbox, ConfirmButton, Field, MoneyInput, QuantityInput, Select, TextArea, TextInput } from "@/components/ui/controls";
import { api, ApiError } from "@/lib/http/client";
import { formatRatePpm } from "@/lib/money/money";
import type { CatalogItem, TaxCategory } from "@/modules/catalog/catalog.types";
import type { CatalogItemInput } from "@/modules/catalog/catalog.validation";
import { LINE_KINDS, LINE_KIND_LABELS, type LineKind } from "@/modules/pricing/pricing.types";

const EMPTY: CatalogItemInput = {
  kind: "PART",
  name: "",
  invoiceDescription: "",
  sku: null,
  category: "",
  unit: "EA",
  defaultQuantityMilli: 1000,
  unitPriceCents: 0,
  taxCategoryId: null,
  keywords: [],
  active: true,
  priceEditable: false,
  quantityEditable: true,
  associatedLaborId: null,
};

function toInput(item: CatalogItem): CatalogItemInput {
  const { id: _id, isDemo: _demo, createdAt: _c, updatedAt: _u, ...input } = item;
  return input;
}

export function CatalogItemForm({
  item,
  catalog,
  taxCategories,
  onSaved,
  onCancel,
  onDeleted,
}: {
  item: CatalogItem | null;
  catalog: CatalogItem[];
  taxCategories: TaxCategory[];
  onSaved: (item: CatalogItem) => void;
  onCancel: () => void;
  onDeleted?: (id: string) => void;
}) {
  const [form, setForm] = useState<CatalogItemInput>(item ? toInput(item) : EMPTY);
  const [keywords, setKeywords] = useState((item?.keywords ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const set = <K extends keyof CatalogItemInput>(key: K, value: CatalogItemInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const fieldError = (path: string) => error?.issues.find((issue) => issue.path === path)?.message;
  const laborOptions = catalog.filter((candidate) => candidate.kind === "LABOR" && candidate.id !== item?.id);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const body: CatalogItemInput = {
      ...form,
      sku: form.sku?.trim() ? form.sku.trim() : null,
      keywords: keywords.split(",").map((keyword) => keyword.trim()).filter(Boolean),
      associatedLaborId: form.kind === "LABOR" ? null : form.associatedLaborId,
    };
    try {
      const result = item
        ? await api<{ item: CatalogItem }>(`/api/catalog/${item.id}`, { method: "PUT", body })
        : await api<{ item: CatalogItem }>("/api/catalog", { method: "POST", body });
      onSaved(result.item);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, "UNKNOWN", "Save failed."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {item?.isDemo && <Alert tone="amber">Demonstration item. Its price came from a sample invoice and is not verified supplier pricing.</Alert>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Type" className="col-span-2 sm:col-span-1">
          {(id) => (
            <Select id={id} value={form.kind} onChange={(event) => set("kind", event.target.value as LineKind)}>
              {LINE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {LINE_KIND_LABELS[kind]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Name" error={fieldError("name")} className="col-span-2 sm:col-span-3">
          {(id, d) => <TextInput id={id} aria-describedby={d} required maxLength={200} value={form.name} onChange={(event) => set("name", event.target.value)} />}
        </Field>
        <Field label="Invoice description" hint="Printed on the invoice. Defaults to the name." className="col-span-2 sm:col-span-4">
          {(id, d) => <TextArea id={id} aria-describedby={d} rows={2} maxLength={2000} value={form.invoiceDescription} onChange={(event) => set("invoiceDescription", event.target.value)} />}
        </Field>
        <Field label="SKU" error={fieldError("sku")}>
          {(id, d) => <TextInput id={id} aria-describedby={d} maxLength={64} value={form.sku ?? ""} onChange={(event) => set("sku", event.target.value)} />}
        </Field>
        <Field label="Category">{(id) => <TextInput id={id} maxLength={80} value={form.category} onChange={(event) => set("category", event.target.value)} />}</Field>
        <Field label="Unit" error={fieldError("unit")}>
          {(id, d) => <TextInput id={id} aria-describedby={d} required maxLength={16} value={form.unit} onChange={(event) => set("unit", event.target.value.toUpperCase())} />}
        </Field>
        <Field label="Default quantity">{(id) => <QuantityInput id={id} value={form.defaultQuantityMilli} onCommit={(value) => value && set("defaultQuantityMilli", value)} />}</Field>
        <Field label="Unit sale price" error={fieldError("unitPriceCents")}>
          {(id, d) => <MoneyInput id={id} aria-describedby={d} value={form.unitPriceCents} onCommit={(value) => value !== null && set("unitPriceCents", value)} />}
        </Field>
        <Field label="Tax category" error={fieldError("taxCategoryId")}>
          {(id, d) => (
            <Select id={id} aria-describedby={d} value={form.taxCategoryId ?? ""} onChange={(event) => set("taxCategoryId", event.target.value || null)}>
              <option value="">Non-taxable</option>
              {taxCategories.map((category) => (
                <option key={category.id} value={category.id} disabled={!category.active}>
                  {category.name} ({formatRatePpm(category.ratePpm)}){category.active ? "" : " — inactive"}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Search keywords" hint="Comma separated" className="col-span-2">
          {(id, d) => <TextInput id={id} aria-describedby={d} value={keywords} onChange={(event) => setKeywords(event.target.value)} />}
        </Field>
        {form.kind !== "LABOR" && (
          <Field label="Associated labor (suggested, never auto-added)" error={fieldError("associatedLaborId")} className="col-span-2 sm:col-span-4">
            {(id, d) => (
              <Select id={id} aria-describedby={d} value={form.associatedLaborId ?? ""} onChange={(event) => set("associatedLaborId", event.target.value || null)}>
                <option value="">None</option>
                {laborOptions.map((labor) => (
                  <option key={labor.id} value={labor.id}>
                    {labor.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Checkbox label="Active" checked={form.active} onChange={(value) => set("active", value)} />
        <Checkbox label="Price can be changed on invoices (reason required)" checked={form.priceEditable} onChange={(value) => set("priceEditable", value)} />
        <Checkbox label="Quantity can be changed" checked={form.quantityEditable} onChange={(value) => set("quantityEditable", value)} />
      </div>
      {error && <Alert>{error.message}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Saving…" : item ? "Save changes" : "Add item"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        {item && onDeleted && (
          <ConfirmButton
            className="ml-auto"
            label="Delete item"
            question={`Delete "${item.name}"?`}
            onConfirm={async () => {
              try {
                await api(`/api/catalog/${item.id}`, { method: "DELETE" });
                onDeleted(item.id);
              } catch (e) {
                setError(e instanceof ApiError ? e : new ApiError(0, "UNKNOWN", "Delete failed."));
              }
            }}
          />
        )}
      </div>
      <p className="text-xs text-zinc-500">
        Changing or deleting an item affects new and draft invoices only. Finalized invoices keep the items and prices they were issued with. To hide an item without deleting it, untick Active.
      </p>
    </form>
  );
}

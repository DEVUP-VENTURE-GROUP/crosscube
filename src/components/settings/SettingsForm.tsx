"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Checkbox, ConfirmButton, Field, IntegerInput, Panel, Select, TextArea, TextInput } from "@/components/ui/controls";
import { api, ApiError } from "@/lib/http/client";
import { formatRatePpm, parsePercentToPpm } from "@/lib/money/money";
import type { TaxCategory } from "@/modules/catalog/catalog.types";
import { formatInvoiceNumber } from "@/modules/invoices/invoice-number.service";
import { MAX_LOGO_DATA_URL_LENGTH, PAPER_SIZES, type ShopSettings, type ShopSettingsInput } from "@/modules/settings/settings.types";

type TextKey = { [K in keyof ShopSettingsInput]: ShopSettingsInput[K] extends string ? K : never }[keyof ShopSettingsInput];

function TaxCategoryRow({ category, onSaved, onDeleted }: { category: TaxCategory; onSaved: (item: TaxCategory) => void; onDeleted: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ code: category.code, name: category.name, rate: formatRatePpm(category.ratePpm).replace("%", "") });
  const [error, setError] = useState<string | null>(null);
  const ppm = parsePercentToPpm(form.rate);

  const save = async (input: { code: string; name: string; ratePpm: number; active: boolean }) => {
    setError(null);
    try {
      const result = await api<{ item: TaxCategory }>(`/api/tax-categories/${category.id}`, { method: "PUT", body: input });
      onSaved(result.item);
      setEditing(false);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.message} ${e.issues.map((i) => i.message).join(" ")}` : "Save failed.");
    }
  };

  return (
    <li className="py-2.5">
      {!editing ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="w-28 font-mono text-xs">{category.code}</span>
          <span className="min-w-32 flex-1">
            {category.name} · {formatRatePpm(category.ratePpm)}
            {!category.active && <span className="ml-2 text-xs text-zinc-500">(off)</span>}
            {category.isDemo && <span className="ml-2 text-xs text-amber-700">demo rate</span>}
          </span>
          <Checkbox label="Active" checked={category.active} onChange={(active) => void save({ code: category.code, name: category.name, ratePpm: category.ratePpm, active })} />
          <Button className="h-8 text-xs" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <ConfirmButton
            className="h-8 text-xs"
            label="Delete"
            question={`Delete ${category.code}?`}
            onConfirm={async () => {
              setError(null);
              try {
                await api(`/api/tax-categories/${category.id}`, { method: "DELETE" });
                onDeleted(category.id);
              } catch (e) {
                setError(e instanceof ApiError ? e.message : "Delete failed.");
              }
            }}
          />
        </div>
      ) : (
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_7rem_auto_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (ppm !== null) void save({ code: form.code.trim().toUpperCase(), name: form.name.trim(), ratePpm: ppm, active: category.active });
          }}
        >
          <Field label="Code">{(id) => <TextInput id={id} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} />}</Field>
          <Field label="Name">{(id) => <TextInput id={id} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />}</Field>
          <Field label="Rate %">{(id) => <TextInput id={id} inputMode="decimal" value={form.rate} onChange={(event) => setForm({ ...form, rate: event.target.value })} />}</Field>
          <Button type="submit" variant="primary" disabled={!form.code || !form.name || ppm === null}>
            Save
          </Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      )}
      {error && <p className="mt-1.5 text-sm text-red-700">{error}</p>}
    </li>
  );
}

function TaxCategories() {
  const [items, setItems] = useState<TaxCategory[]>([]);
  const [draft, setDraft] = useState({ code: "", name: "", rate: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: TaxCategory[] }>("/api/tax-categories").then((data) => setItems(data.items), () => setError("Could not load tax categories."));
  }, []);

  const newRate = parsePercentToPpm(draft.rate);
  return (
    <Panel title="Tax categories">
      <p className="mb-3 text-sm text-zinc-600">
        Rates are applied per category to the summed taxable amount and rounded once (half up). Items without a category are not taxed. Confirm rates and taxability with your jurisdiction; changes apply to drafts, never to finalized invoices. A category used by catalog items can be turned off but not deleted.
      </p>
      <ul className="mb-4 divide-y divide-zinc-100">
        {items.map((category) => (
          <TaxCategoryRow
            key={category.id}
            category={category}
            onSaved={(saved) => setItems((current) => current.map((c) => (c.id === saved.id ? saved : c)))}
            onDeleted={(id) => setItems((current) => current.filter((c) => c.id !== id))}
          />
        ))}
        {items.length === 0 && <li className="py-2 text-sm text-zinc-500">No tax categories. Items without one are not taxed.</li>}
      </ul>
      <form
        className="grid grid-cols-2 gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_7rem_auto] sm:items-end"
        onSubmit={async (event) => {
          event.preventDefault();
          if (newRate === null) return;
          setError(null);
          try {
            const result = await api<{ item: TaxCategory }>("/api/tax-categories", {
              method: "POST",
              body: { code: draft.code.trim().toUpperCase(), name: draft.name.trim(), ratePpm: newRate, active: true },
            });
            setItems((current) => [...current, result.item]);
            setDraft({ code: "", name: "", rate: "" });
          } catch (e) {
            setError(e instanceof ApiError ? `${e.message} ${e.issues.map((i) => i.message).join(" ")}` : "Save failed.");
          }
        }}
      >
        <Field label="Code">{(id) => <TextInput id={id} value={draft.code} placeholder="PARTS" onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })} />}</Field>
        <Field label="Name">{(id) => <TextInput id={id} value={draft.name} placeholder="Sales Tax" onChange={(event) => setDraft({ ...draft, name: event.target.value })} />}</Field>
        <Field label="Rate %">{(id) => <TextInput id={id} value={draft.rate} inputMode="decimal" placeholder="8.25" onChange={(event) => setDraft({ ...draft, rate: event.target.value })} />}</Field>
        <Button type="submit" disabled={!draft.code || !draft.name || newRate === null}>
          Add category
        </Button>
      </form>
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
    </Panel>
  );
}

export function SettingsForm() {
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [nextNumber, setNextNumber] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "red" | "green"; text: string } | null>(null);
  const [issues, setIssues] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    api<{ settings: ShopSettings }>("/api/settings").then(
      (data) => {
        setSettings(data.settings);
        setNextNumber(data.settings.nextInvoiceNumber);
      },
      (e: unknown) => setMessage({ tone: "red", text: e instanceof ApiError ? e.message : "Could not load settings." }),
    );
  }, []);

  if (!settings) {
    return <main className="mx-auto max-w-4xl px-4 py-6">{message ? <Alert>{message.text}</Alert> : <p className="text-sm text-zinc-500">Loading…</p>}</main>;
  }

  const set = <K extends keyof ShopSettings>(key: K, value: ShopSettings[K]) => setSettings({ ...settings, [key]: value });
  const text = (key: TextKey, label: string, options: { className?: string; max?: number; type?: string } = {}) => (
    <Field label={label} error={issues.get(`settings.${key}`)} className={options.className}>
      {(id, d) => (
        <TextInput id={id} aria-describedby={d} type={options.type ?? "text"} maxLength={options.max} value={settings[key]} onChange={(event) => set(key, event.target.value)} />
      )}
    </Field>
  );
  const area = (key: TextKey, label: string, hint: string) => (
    <Field label={label} hint={hint} error={issues.get(`settings.${key}`)} className="col-span-full">
      {(id, d) => <TextArea id={id} aria-describedby={d} rows={3} maxLength={3000} value={settings[key]} onChange={(event) => set(key, event.target.value)} />}
    </Field>
  );

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setIssues(new Map());
    const { nextInvoiceNumber: current, updatedAt: _updated, ...input } = settings;
    try {
      const result = await api<{ settings: ShopSettings }>("/api/settings", {
        method: "PUT",
        body: { settings: input, ...(nextNumber !== null && nextNumber !== current ? { nextInvoiceNumber: nextNumber } : {}) },
      });
      setSettings(result.settings);
      setNextNumber(result.settings.nextInvoiceNumber);
      setMessage({ tone: "green", text: "Settings saved." });
    } catch (e) {
      const apiError = e instanceof ApiError ? e : null;
      setIssues(new Map((apiError?.issues ?? []).map((issue) => [issue.path, issue.message])));
      setMessage({ tone: "red", text: apiError?.message ?? "Save failed." });
    } finally {
      setSaving(false);
    }
  };

  const onLogo = (file: File | undefined) => {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setMessage({ tone: "red", text: "Logo must be a PNG or JPEG image." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      if (result.length > MAX_LOGO_DATA_URL_LENGTH) setMessage({ tone: "red", text: "Logo is too large; use an image under about 290 KB." });
      else set("logoDataUrl", result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Panel title="Business">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            {text("businessName", "Business name", { className: "col-span-2 sm:col-span-6", max: 120 })}
            {text("addressLine1", "Street address", { className: "col-span-2 sm:col-span-3", max: 120 })}
            {text("addressLine2", "Address line 2", { className: "col-span-2 sm:col-span-3", max: 120 })}
            {text("city", "City", { className: "col-span-2 sm:col-span-3", max: 80 })}
            {text("state", "State", { className: "col-span-1", max: 40 })}
            {text("postalCode", "ZIP", { className: "col-span-1 sm:col-span-2", max: 20 })}
            {text("phone", "Phone", { className: "col-span-1 sm:col-span-3", max: 40, type: "tel" })}
            {text("fax", "Fax", { className: "col-span-1 sm:col-span-2", max: 40, type: "tel" })}
            {text("organizationNumber", "Org. #", { className: "col-span-2 sm:col-span-1", max: 30 })}
            {text("website", "Website", { className: "col-span-2 sm:col-span-3", max: 200 })}
            {text("email", "Email", { className: "col-span-2 sm:col-span-3", max: 254, type: "email" })}
            <div className="col-span-full flex flex-wrap items-center gap-3">
              {settings.logoDataUrl && <img src={settings.logoDataUrl} alt="Current logo" className="h-12 max-w-40 rounded border border-zinc-200 object-contain p-1" />}
              <label className="text-sm text-zinc-700">
                <span className="mb-1 block text-xs font-medium text-zinc-600">Logo (PNG or JPEG)</span>
                <input type="file" accept="image/png,image/jpeg" className="text-sm" onChange={(event) => onLogo(event.target.files?.[0])} />
              </label>
              {settings.logoDataUrl && (
                <Button variant="ghost" className="h-8 text-xs" onClick={() => set("logoDataUrl", null)}>
                  Remove logo
                </Button>
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Invoice document">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            {text("invoiceTitle", "Document title", { className: "col-span-2", max: 40 })}
            {text("invoiceNumberPrefix", "Number prefix", { className: "col-span-1", max: 12 })}
            <Field label="Digits" className="col-span-1">
              {(id) => <IntegerInput id={id} value={settings.invoiceNumberPad} onCommit={(value) => value !== null && set("invoiceNumberPad", Math.min(Math.max(value, 1), 10))} />}
            </Field>
            <Field label="Next number" error={issues.get("nextInvoiceNumber")} hint={`Next: ${formatInvoiceNumber(nextNumber ?? 1, settings.invoiceNumberPrefix, settings.invoiceNumberPad)}`} className="col-span-2">
              {(id, d) => <IntegerInput id={id} aria-describedby={d} value={nextNumber} onCommit={setNextNumber} />}
            </Field>
            <Field label="Paper size" className="col-span-1 sm:col-span-2">
              {(id) => (
                <Select id={id} value={settings.paperSize} onChange={(event) => set("paperSize", event.target.value as ShopSettings["paperSize"])}>
                  {PAPER_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size === "LETTER" ? "US Letter" : "A4"}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {text("timeZone", "Time zone (IANA)", { className: "col-span-1 sm:col-span-4", max: 64 })}
            <div className="col-span-full flex flex-wrap gap-x-6 gap-y-2">
              <Checkbox label="Show shop supplies in the parts table and parts total" checked={settings.shopSuppliesInParts} onChange={(value) => set("shopSuppliesInParts", value)} />
              <Checkbox label="Print signature and date lines" checked={settings.showSignatureLines} onChange={(value) => set("showSignatureLines", value)} />
            </div>
            {area("authorizationText", "Customer authorization text", "Printed above the signature line. Leave empty unless your business has approved wording.")}
            {area("warrantyText", "Warranty terms", "Printed in the footer. Use only terms your business has approved.")}
            {area("footerNote", "Footer note", "Optional short note, e.g. payment terms.")}
          </div>
        </Panel>

        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
        <p className="text-xs text-zinc-500">Business details are copied onto each invoice when it is finalized; changing them later does not alter issued invoices.</p>
      </form>

      <TaxCategories />
    </main>
  );
}

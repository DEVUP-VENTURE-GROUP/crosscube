"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Button, ConfirmButton, Field, IntegerInput, Panel, Select, TextArea, TextInput } from "@/components/ui/controls";
import { api, ApiError } from "@/lib/http/client";
import type { CustomerRecord, VehicleRecord } from "@/modules/customers/customer.service";
import { EMPTY_CUSTOMER, EMPTY_VEHICLE, vehicleLabel, type CustomerSnapshot, type VehicleSnapshot } from "@/modules/invoices/invoice.types";

function errorText(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  return [error.message, ...error.issues.map((issue) => issue.message)].join(" ");
}

function CustomerForm({ initial, submitLabel, onSubmit }: { initial: CustomerSnapshot; submitLabel: string; onSubmit: (value: CustomerSnapshot) => Promise<void> }) {
  const [form, setForm] = useState<CustomerSnapshot>({ ...EMPTY_CUSTOMER, ...initial });
  const [saving, setSaving] = useState(false);
  const set = (key: keyof CustomerSnapshot, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const field = (key: keyof CustomerSnapshot, label: string, className: string, max: number, type = "text") => (
    <Field label={label} className={className}>
      {(id) => <TextInput id={id} type={type} maxLength={max} value={form[key]} onChange={(event) => set(key, event.target.value)} />}
    </Field>
  );
  return (
    <form
      className="grid grid-cols-2 gap-3 sm:grid-cols-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await onSubmit(form);
        } finally {
          setSaving(false);
        }
      }}
    >
      {field("name", "Name", "col-span-2 sm:col-span-3", 120)}
      {field("company", "Company", "col-span-2 sm:col-span-3", 120)}
      <Field label="Phone type" className="col-span-1 sm:col-span-2">
        {(id) => (
          <Select id={id} value={form.phoneLabel} onChange={(event) => set("phoneLabel", event.target.value)}>
            {["Phone", "Office", "Cell", "Home", "Work"].map((label) => (
              <option key={label}>{label}</option>
            ))}
          </Select>
        )}
      </Field>
      {field("phone", "Phone", "col-span-1 sm:col-span-2", 40, "tel")}
      {field("customerNumber", "Customer #", "col-span-2 sm:col-span-2", 20)}
      {field("email", "Email", "col-span-2 sm:col-span-6", 254, "email")}
      {field("addressLine1", "Address", "col-span-2 sm:col-span-6", 120)}
      {field("city", "City", "col-span-2 sm:col-span-3", 80)}
      {field("state", "State", "col-span-1", 40)}
      {field("postalCode", "ZIP", "col-span-1 sm:col-span-2", 20)}
      <div className="col-span-full">
        <Button type="submit" variant="primary" disabled={saving || !form.name.trim()}>
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function VehicleForm({ initial, submitLabel, onSubmit, onCancel }: { initial: VehicleSnapshot; submitLabel: string; onSubmit: (value: VehicleSnapshot) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState<VehicleSnapshot>(initial);
  const [saving, setSaving] = useState(false);
  const setText = (key: "make" | "model" | "trim" | "engine" | "vin" | "licensePlate" | "notes", value: string) => setForm((current) => ({ ...current, [key]: value }));
  const field = (key: "make" | "model" | "trim" | "engine" | "vin" | "licensePlate", label: string, className: string, max: number) => (
    <Field label={label} className={className}>
      {(id) => <TextInput id={id} maxLength={max} value={form[key]} onChange={(event) => setText(key, key === "vin" || key === "licensePlate" ? event.target.value.toUpperCase() : event.target.value)} />}
    </Field>
  );
  return (
    <form
      className="grid grid-cols-2 gap-3 rounded border border-zinc-200 p-3 sm:grid-cols-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await onSubmit(form);
        } finally {
          setSaving(false);
        }
      }}
    >
      <Field label="Year" className="col-span-1">
        {(id) => <IntegerInput id={id} value={form.year} maxLength={4} onCommit={(value) => setForm((current) => ({ ...current, year: value }))} />}
      </Field>
      {field("make", "Make", "col-span-1 sm:col-span-2", 60)}
      {field("model", "Model", "col-span-2 sm:col-span-3", 60)}
      {field("trim", "Trim", "col-span-1 sm:col-span-2", 60)}
      {field("engine", "Engine", "col-span-1 sm:col-span-4", 80)}
      {field("vin", "VIN", "col-span-2 sm:col-span-4", 40)}
      {field("licensePlate", "License plate", "col-span-1 sm:col-span-2", 16)}
      <Field label="Odometer" className="col-span-1 sm:col-span-2">
        {(id) => <IntegerInput id={id} value={form.odometer} onCommit={(value) => setForm((current) => ({ ...current, odometer: value }))} />}
      </Field>
      <Field label="Notes" className="col-span-2 sm:col-span-4">
        {(id) => <TextArea id={id} rows={2} maxLength={2000} value={form.notes} onChange={(event) => setText("notes", event.target.value)} />}
      </Field>
      <div className="col-span-full flex gap-2">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function CustomerDetail({ customer, onChanged, onDeleted }: { customer: CustomerRecord; onChanged: (customer: CustomerRecord) => void; onDeleted: (id: string) => void }) {
  const [editingVehicle, setEditingVehicle] = useState<string | "new" | null>(null);
  const [message, setMessage] = useState<{ tone: "red" | "green"; text: string } | null>(null);
  const { id, vehicles, ...snapshot } = customer;

  const saveVehicle = async (vehicleId: string | "new", value: VehicleSnapshot) => {
    setMessage(null);
    try {
      const result =
        vehicleId === "new"
          ? await api<{ vehicle: VehicleRecord }>(`/api/customers/${id}/vehicles`, { method: "POST", body: value })
          : await api<{ vehicle: VehicleRecord }>(`/api/vehicles/${vehicleId}`, { method: "PUT", body: value });
      const next = vehicleId === "new" ? [result.vehicle, ...vehicles] : vehicles.map((v) => (v.id === vehicleId ? result.vehicle : v));
      onChanged({ ...customer, vehicles: next });
      setEditingVehicle(null);
      setMessage({ tone: "green", text: "Vehicle saved." });
    } catch (error) {
      setMessage({ tone: "red", text: errorText(error, "Could not save the vehicle.") });
    }
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Customer details"
        actions={
          <ConfirmButton
            className="h-8 text-xs"
            label="Delete customer"
            question="Delete customer and their vehicles?"
            onConfirm={async () => {
              try {
                await api(`/api/customers/${id}`, { method: "DELETE" });
                onDeleted(id);
              } catch (error) {
                setMessage({ tone: "red", text: errorText(error, "Could not delete the customer.") });
              }
            }}
          />
        }
      >
        <CustomerForm
          key={id}
          initial={snapshot}
          submitLabel="Save customer"
          onSubmit={async (value) => {
            setMessage(null);
            try {
              const result = await api<{ customer: CustomerRecord }>(`/api/customers/${id}`, { method: "PUT", body: value });
              onChanged(result.customer);
              setMessage({ tone: "green", text: "Customer saved." });
            } catch (error) {
              setMessage({ tone: "red", text: errorText(error, "Could not save the customer.") });
            }
          }}
        />
      </Panel>

      <Panel
        title={`Vehicles (${vehicles.length})`}
        actions={
          editingVehicle !== "new" && (
            <Button className="h-8 text-xs" onClick={() => setEditingVehicle("new")}>
              Add vehicle
            </Button>
          )
        }
      >
        <div className="space-y-3">
          {editingVehicle === "new" && <VehicleForm initial={EMPTY_VEHICLE} submitLabel="Add vehicle" onSubmit={(value) => saveVehicle("new", value)} onCancel={() => setEditingVehicle(null)} />}
          {vehicles.length === 0 && editingVehicle !== "new" && <p className="text-sm text-zinc-500">No vehicles saved for this customer.</p>}
          {vehicles.map((vehicle) =>
            editingVehicle === vehicle.id ? (
              <VehicleForm key={vehicle.id} initial={vehicle} submitLabel="Save vehicle" onSubmit={(value) => saveVehicle(vehicle.id, value)} onCancel={() => setEditingVehicle(null)} />
            ) : (
              <div key={vehicle.id} className="flex flex-wrap items-center gap-3 border-b border-zinc-100 pb-3 text-sm last:border-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{vehicleLabel(vehicle) || "Vehicle"}</div>
                  <div className="text-xs text-zinc-500">
                    {[vehicle.vin && `VIN ${vehicle.vin}`, vehicle.licensePlate && `Plate ${vehicle.licensePlate}`, vehicle.odometer !== null && `${vehicle.odometer.toLocaleString("en-US")} mi`].filter(Boolean).join(" · ") || "No VIN or plate"}
                  </div>
                </div>
                <Button className="h-8 text-xs" onClick={() => setEditingVehicle(vehicle.id)}>
                  Edit
                </Button>
                <ConfirmButton
                  className="h-8 text-xs"
                  label="Delete"
                  question="Delete vehicle?"
                  onConfirm={async () => {
                    try {
                      await api(`/api/vehicles/${vehicle.id}`, { method: "DELETE" });
                      onChanged({ ...customer, vehicles: vehicles.filter((v) => v.id !== vehicle.id) });
                    } catch (error) {
                      setMessage({ tone: "red", text: errorText(error, "Could not delete the vehicle.") });
                    }
                  }}
                />
              </div>
            ),
          )}
        </div>
      </Panel>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <p className="text-xs text-zinc-500">Changes here apply to future invoices. Issued invoices keep the customer and vehicle details they were printed with.</p>
    </div>
  );
}

export function CustomerManager() {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerRecord[] | null>(null);
  const [selected, setSelected] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string, signal?: AbortSignal) => {
    try {
      const data = await api<{ items: CustomerRecord[] }>(`/api/customers?q=${encodeURIComponent(q)}`, { signal });
      setCustomers(data.items);
      setError(null);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setError(errorText(e, "Could not load customers."));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void load(query, controller.signal), 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, load]);

  const current = customers?.find((customer) => customer.id === selected) ?? null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Customers</h1>
        <p className="text-sm text-zinc-500">Customers and vehicles are also saved automatically when an invoice is finalized.</p>
        <Button variant="primary" className="ml-auto" onClick={() => setSelected("new")}>
          New customer
        </Button>
      </div>
      {error && (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="rounded border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 p-3">
            <TextInput type="search" aria-label="Search customers" placeholder="Search name, phone, VIN or plate…" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <ul className="max-h-[70vh] divide-y divide-zinc-100 overflow-auto">
            {customers === null && <li className="p-3 text-sm text-zinc-500">Loading…</li>}
            {customers?.length === 0 && <li className="p-3 text-sm text-zinc-500">{query ? "No customers match." : "No customers yet."}</li>}
            {customers?.map((customer) => (
              <li key={customer.id}>
                <button
                  type="button"
                  onClick={() => setSelected(customer.id)}
                  aria-current={selected === customer.id ? "true" : undefined}
                  className={`block w-full px-3 py-2.5 text-left text-sm hover:bg-zinc-50 ${selected === customer.id ? "bg-zinc-100" : ""}`}
                >
                  <span className="font-medium">{customer.name || "Unnamed"}</span>
                  {customer.company && <span className="text-zinc-500"> · {customer.company}</span>}
                  <span className="block text-xs text-zinc-500">
                    {[customer.phone, `${customer.vehicles.length} vehicle${customer.vehicles.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <div>
          {selected === "new" && (
            <Panel title="New customer">
              <CustomerForm
                initial={EMPTY_CUSTOMER}
                submitLabel="Add customer"
                onSubmit={async (value) => {
                  try {
                    const result = await api<{ customer: CustomerRecord }>("/api/customers", { method: "POST", body: value });
                    setCustomers((list) => [result.customer, ...(list ?? [])]);
                    setSelected(result.customer.id);
                  } catch (e) {
                    setError(errorText(e, "Could not add the customer."));
                  }
                }}
              />
            </Panel>
          )}
          {current && (
            <CustomerDetail
              key={current.id}
              customer={current}
              onChanged={(next) => setCustomers((list) => (list ?? []).map((customer) => (customer.id === next.id ? next : customer)))}
              onDeleted={(id) => {
                setCustomers((list) => (list ?? []).filter((customer) => customer.id !== id));
                setSelected(null);
              }}
            />
          )}
          {!current && selected !== "new" && <p className="rounded border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">Select a customer to view or edit, or add a new one.</p>}
        </div>
      </div>
    </main>
  );
}

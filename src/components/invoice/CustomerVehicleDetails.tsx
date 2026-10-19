"use client";

import { useEffect, useRef, useState } from "react";
import { Field, IntegerInput, MoneyInput, Select, TextInput } from "@/components/ui/controls";
import { api } from "@/lib/http/client";
import type { CustomerRecord } from "@/modules/customers/customer.service";
import type { CustomerSnapshot, VehicleSnapshot } from "@/modules/invoices/invoice.types";
import { vehicleLabel } from "@/modules/invoices/invoice.types";
import type { DraftInput } from "@/modules/invoices/invoice.validation";
import { checkVin, normalizeVin } from "@/modules/vehicles/vin";

type Update = (recipe: (draft: DraftInput) => DraftInput) => void;

function CustomerLookup({ update, disabled }: { update: Update; disabled: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerRecord[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setStatus("loading");
      api<{ items: CustomerRecord[] }>(`/api/customers?mode=lookup&q=${encodeURIComponent(trimmed)}`, { signal: controller.signal }).then(
        (data) => {
          setResults(data.items);
          setStatus("idle");
        },
        (error: unknown) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
        },
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const pick = (customer: CustomerRecord, vehicle: (VehicleSnapshot & { id: string }) | null) => {
    const { id, vehicles: _vehicles, ...snapshot } = customer;
    update((draft) => ({
      ...draft,
      customerId: id,
      customer: snapshot,
      ...(vehicle ? { vehicleId: vehicle.id, vehicle: { ...stripId(vehicle) } } : {}),
    }));
    setQuery("");
    setResults([]);
  };

  return (
    <div className="relative">
      <Field label="Find existing customer" hint="Name, phone, VIN or plate">
        {(id, describedBy) => (
          <TextInput id={id} aria-describedby={describedBy} type="search" value={query} disabled={disabled} onChange={(event) => setQuery(event.target.value)} placeholder="Search customers…" />
        )}
      </Field>
      {query.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-md border border-zinc-200 bg-white text-sm shadow-lg">
          {status === "loading" && results.length === 0 && <p className="px-3 py-2 text-zinc-500">Searching…</p>}
          {status === "error" && <p className="px-3 py-2 text-red-700">Customer search failed.</p>}
          {status === "idle" && results.length === 0 && <p className="px-3 py-2 text-zinc-500">No saved customers match. Enter details below; they are saved when the invoice is finalized.</p>}
          {results.map((customer) => (
            <div key={customer.id} className="border-b border-zinc-100 px-3 py-2 last:border-0">
              <button type="button" className="w-full text-left hover:text-zinc-900" onClick={() => pick(customer, null)}>
                <span className="font-medium">{customer.name}</span>
                {customer.company && <span className="text-zinc-500"> · {customer.company}</span>}
                <span className="block text-xs text-zinc-500">{customer.phone || customer.email}</span>
              </button>
              {customer.vehicles.map((vehicle) => (
                <button key={vehicle.id} type="button" className="mt-1 block w-full rounded px-2 py-1 text-left text-xs text-zinc-700 hover:bg-zinc-100" onClick={() => pick(customer, vehicle)}>
                  {vehicleLabel(vehicle) || "Vehicle"} {vehicle.vin && <span className="text-zinc-500">· VIN {vehicle.vin}</span>}
                  {vehicle.licensePlate && <span className="text-zinc-500"> · {vehicle.licensePlate}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function stripId({ id: _id, ...vehicle }: VehicleSnapshot & { id: string }): VehicleSnapshot {
  return vehicle;
}

export function CustomerVehicleDetails({ draft, update, errors, disabled }: { draft: DraftInput; update: Update; errors: Map<string, string>; disabled: boolean }) {
  const setCustomer = <K extends keyof CustomerSnapshot>(key: K, value: CustomerSnapshot[K]) =>
    update((d) => ({ ...d, customer: { ...d.customer, [key]: value } }));
  const setVehicle = <K extends keyof VehicleSnapshot>(key: K, value: VehicleSnapshot[K]) =>
    update((d) => ({ ...d, vehicle: { ...d.vehicle, [key]: value } }));

  const text = (label: string, value: string, onChange: (value: string) => void, path: string, options: { className?: string; type?: string; autoComplete?: string; maxLength?: number } = {}) => (
    <Field label={label} error={errors.get(path)} className={options.className}>
      {(id, describedBy) => (
        <TextInput
          id={id}
          aria-describedby={describedBy}
          invalid={errors.has(path)}
          type={options.type ?? "text"}
          autoComplete={options.autoComplete ?? "off"}
          maxLength={options.maxLength}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );

  const vin = checkVin(draft.vehicle.vin);
  const vinHint =
    vin.status === "valid" ? (vin.checkDigit === "match" ? "Format and check digit OK (does not confirm history or ownership)." : "Check digit mismatch — verify the VIN.") : undefined;

  return (
    <div className="space-y-5">
      <CustomerLookup update={update} disabled={disabled} />
      {draft.customerId && (
        <p className="text-xs text-zinc-500">
          Linked to a saved customer.{" "}
          <button type="button" className="text-zinc-900 underline" disabled={disabled} onClick={() => update((d) => ({ ...d, customerId: null, vehicleId: null }))}>
            Unlink
          </button>
        </p>
      )}
      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <legend className="col-span-full mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">Customer</legend>
        {text("Name", draft.customer.name, (v) => setCustomer("name", v), "customer.name", { className: "col-span-2 sm:col-span-3", maxLength: 120 })}
        {text("Company", draft.customer.company, (v) => setCustomer("company", v), "customer.company", { className: "col-span-2 sm:col-span-3", maxLength: 120 })}
        <Field label="Phone type" className="col-span-1 sm:col-span-1">
          {(id) => (
            <Select id={id} value={draft.customer.phoneLabel} disabled={disabled} onChange={(event) => setCustomer("phoneLabel", event.target.value)}>
              {["Phone", "Office", "Cell", "Home", "Work"].map((label) => (
                <option key={label}>{label}</option>
              ))}
            </Select>
          )}
        </Field>
        {text("Phone", draft.customer.phone, (v) => setCustomer("phone", v), "customer.phone", { className: "col-span-1 sm:col-span-2", type: "tel", maxLength: 40 })}
        {text("Customer #", draft.customer.customerNumber, (v) => setCustomer("customerNumber", v), "customer.customerNumber", { className: "col-span-2 sm:col-span-3", maxLength: 20 })}
        {text("Email", draft.customer.email, (v) => setCustomer("email", v), "customer.email", { className: "col-span-2 sm:col-span-6", type: "email", maxLength: 254 })}
        {text("Address", draft.customer.addressLine1, (v) => setCustomer("addressLine1", v), "customer.addressLine1", { className: "col-span-2 sm:col-span-6", maxLength: 120 })}
        {text("City", draft.customer.city, (v) => setCustomer("city", v), "customer.city", { className: "col-span-2 sm:col-span-3", maxLength: 80 })}
        {text("State", draft.customer.state, (v) => setCustomer("state", v), "customer.state", { className: "col-span-1 sm:col-span-1", maxLength: 40 })}
        {text("ZIP", draft.customer.postalCode, (v) => setCustomer("postalCode", v), "customer.postalCode", { className: "col-span-1 sm:col-span-2", maxLength: 20 })}
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <legend className="col-span-full mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">Vehicle</legend>
        <Field label="Year" error={errors.get("vehicle.year")} className="col-span-1 sm:col-span-1">
          {(id, describedBy) => (
            <IntegerInput id={id} aria-describedby={describedBy} value={draft.vehicle.year} disabled={disabled} maxLength={4} onCommit={(v) => setVehicle("year", v)} />
          )}
        </Field>
        {text("Make", draft.vehicle.make, (v) => setVehicle("make", v), "vehicle.make", { className: "col-span-1 sm:col-span-2", maxLength: 60 })}
        {text("Model", draft.vehicle.model, (v) => setVehicle("model", v), "vehicle.model", { className: "col-span-2 sm:col-span-3", maxLength: 60 })}
        {text("Trim", draft.vehicle.trim, (v) => setVehicle("trim", v), "vehicle.trim", { className: "col-span-1 sm:col-span-2", maxLength: 60 })}
        {text("Engine", draft.vehicle.engine, (v) => setVehicle("engine", v), "vehicle.engine", { className: "col-span-1 sm:col-span-4", maxLength: 80 })}
        <Field label="VIN" error={errors.get("vehicle.vin")} hint={vinHint} className="col-span-2 sm:col-span-4">
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={errors.has("vehicle.vin")}
              value={draft.vehicle.vin}
              disabled={disabled}
              maxLength={40}
              className="font-mono uppercase"
              onChange={(event) => setVehicle("vin", event.target.value.toUpperCase())}
              onBlur={() => draft.vehicle.vin !== normalizeVin(draft.vehicle.vin) && setVehicle("vin", normalizeVin(draft.vehicle.vin))}
            />
          )}
        </Field>
        {text("License plate", draft.vehicle.licensePlate, (v) => setVehicle("licensePlate", v.toUpperCase()), "vehicle.licensePlate", { className: "col-span-2 sm:col-span-2", maxLength: 16 })}
        <Field label="Odometer" error={errors.get("vehicle.odometer")} className="col-span-1 sm:col-span-2">
          {(id, describedBy) => (
            <IntegerInput id={id} aria-describedby={describedBy} value={draft.vehicle.odometer} disabled={disabled} onCommit={(v) => setVehicle("odometer", v)} />
          )}
        </Field>
        <Field label="Service date" error={errors.get("serviceDate")} className="col-span-1 sm:col-span-2">
          {(id, describedBy) => (
            <TextInput id={id} aria-describedby={describedBy} type="date" value={draft.serviceDate} disabled={disabled} onChange={(event) => update((d) => ({ ...d, serviceDate: event.target.value }))} />
          )}
        </Field>
        {text("Org. estimate #", draft.estimateNumber, (v) => update((d) => ({ ...d, estimateNumber: v })), "estimateNumber", { className: "col-span-1 sm:col-span-2", maxLength: 40 })}
        <Field label="Original estimate $" hint="Shows Org. Estimate / Revisions" className="col-span-1 sm:col-span-2">
          {(id, describedBy) => (
            <MoneyInput id={id} aria-describedby={describedBy} value={draft.originalEstimateCents} disabled={disabled} onCommit={(v) => update((d) => ({ ...d, originalEstimateCents: v }))} />
          )}
        </Field>
      </fieldset>
    </div>
  );
}

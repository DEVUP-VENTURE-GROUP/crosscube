import { describe, expect, it } from "vitest";
import { searchCustomers } from "@/modules/customers/customer.service";
import { demoDraft } from "@/modules/demo/demo-data";
import { createDraft, finalizeInvoice } from "@/modules/invoices/invoice.service";
import { useTestDatabase } from "./helpers";

const { c } = useTestDatabase();

function draftFor(name: string, phone: string, vin: string) {
  const draft = demoDraft();
  return { ...draft, customer: { ...draft.customer, name, phone }, vehicle: { ...draft.vehicle, vin } };
}

describe("customer and vehicle records", () => {
  it("reuses an existing customer and vehicle on repeat visits", async () => {
    const first = await finalizeInvoice((await createDraft(crypto.randomUUID(), draftFor("Pat Rivera", "(555) 222-3333", "1M8GDM9AXKP042788"))).id);
    const second = await finalizeInvoice((await createDraft(crypto.randomUUID(), draftFor("pat rivera", "555-222-3333", "1M8GDM9AXKP042788"))).id);
    expect(second.invoice.customerId).toBe(first.invoice.customerId);
    expect(second.invoice.vehicleId).toBe(first.invoice.vehicleId);
    expect(await c().customers.countDocuments({ phoneDigits: "5552223333" })).toBe(1);
  });

  it("searches by name, phone digits, VIN and plate", async () => {
    const draft = draftFor("Jordan Lee", "(555) 777-8888", "11111111111111111");
    draft.vehicle.licensePlate = "JLEE01";
    await finalizeInvoice((await createDraft(crypto.randomUUID(), draft)).id);

    for (const query of ["jordan", "7778888", "11111111111111111", "jlee01"]) {
      const results = await searchCustomers(query);
      expect(results.map((customer) => customer.name), query).toContain("Jordan Lee");
    }
    const [jordan] = await searchCustomers("Jordan");
    expect(jordan!.vehicles[0]).toMatchObject({ vin: "11111111111111111", licensePlate: "JLEE01" });
  });

  it("treats regex characters in queries literally", async () => {
    expect(await searchCustomers(".*")).toEqual([]);
    expect(await searchCustomers("a")).toEqual([]);
  });
});

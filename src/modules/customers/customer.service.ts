import type { Collections, CustomerDoc, VehicleDoc } from "@/lib/db/collections";
import { db } from "@/lib/db/mongo";
import type { CustomerSnapshot, VehicleSnapshot } from "@/modules/invoices/invoice.types";

export interface CustomerRecord extends CustomerSnapshot {
  id: string;
  vehicles: (VehicleSnapshot & { id: string })[];
}

const CASE_INSENSITIVE = { locale: "en", strength: 2 } as const;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

function stripCustomer({ _id, phoneDigits: _digits, createdAt: _c, updatedAt: _u, ...snapshot }: CustomerDoc): CustomerSnapshot & { id: string } {
  return { id: _id, ...snapshot };
}

function stripVehicle({ _id, customerId: _owner, createdAt: _c, updatedAt: _u, ...snapshot }: VehicleDoc): VehicleSnapshot & { id: string } {
  return { id: _id, ...snapshot };
}

export async function searchCustomers(rawQuery: string): Promise<CustomerRecord[]> {
  const query = rawQuery.trim().slice(0, 60);
  if (query.length < 2) return [];
  const c = await db();
  const digits = phoneDigits(query);
  const vehicleMatches = await c.vehicles
    .find({ $or: [{ vin: query.toUpperCase() }, { licensePlate: query.toUpperCase() }] }, { projection: { customerId: 1 } })
    .limit(10)
    .toArray();
  const filters: object[] = [{ name: { $regex: escapeRegex(query), $options: "i" } }, { company: { $regex: escapeRegex(query), $options: "i" } }];
  if (digits.length >= 4) filters.push({ phoneDigits: { $regex: escapeRegex(digits) } });
  const ownerIds = vehicleMatches.map((v) => v.customerId).filter((id): id is string => Boolean(id));
  if (ownerIds.length) filters.push({ _id: { $in: ownerIds } });

  const customers = await c.customers.find({ $or: filters }).sort({ updatedAt: -1 }).limit(10).toArray();
  const vehicles = await c.vehicles
    .find({ customerId: { $in: customers.map((customer) => customer._id) } })
    .sort({ updatedAt: -1 })
    .limit(100)
    .toArray();
  return customers.map((customer) => ({
    ...stripCustomer(customer),
    vehicles: vehicles.filter((vehicle) => vehicle.customerId === customer._id).map(stripVehicle),
  }));
}

export async function upsertCustomer(c: Collections, customerId: string | null, snapshot: CustomerSnapshot, now: Date): Promise<string> {
  const fields = { ...snapshot, phoneDigits: phoneDigits(snapshot.phone), updatedAt: now };
  if (customerId) {
    const result = await c.customers.updateOne({ _id: customerId }, { $set: fields });
    if (result.matchedCount === 1) return customerId;
  }
  if (fields.phoneDigits) {
    const existing = await c.customers.findOne({ phoneDigits: fields.phoneDigits, name: snapshot.name }, { collation: CASE_INSENSITIVE });
    if (existing) {
      await c.customers.updateOne({ _id: existing._id }, { $set: fields });
      return existing._id;
    }
  }
  const id = crypto.randomUUID();
  await c.customers.insertOne({ _id: id, ...fields, createdAt: now });
  return id;
}

export async function upsertVehicle(
  c: Collections,
  vehicleId: string | null,
  snapshot: VehicleSnapshot,
  customerId: string,
  now: Date,
): Promise<string> {
  const fields = { ...snapshot, customerId, updatedAt: now };
  if (vehicleId) {
    const result = await c.vehicles.updateOne({ _id: vehicleId }, { $set: fields });
    if (result.matchedCount === 1) return vehicleId;
  }
  if (snapshot.vin) {
    const existing = await c.vehicles.findOne({ vin: snapshot.vin });
    if (existing) {
      await c.vehicles.updateOne({ _id: existing._id }, { $set: fields });
      return existing._id;
    }
  }
  const id = crypto.randomUUID();
  await c.vehicles.insertOne({ _id: id, ...fields, createdAt: now });
  return id;
}

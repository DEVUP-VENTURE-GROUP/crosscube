import type { Collections, CustomerDoc, VehicleDoc } from "@/lib/db/collections";
import { db } from "@/lib/db/mongo";
import { notFound } from "@/lib/errors/app-error";
import type { CustomerSnapshot, VehicleSnapshot } from "@/modules/invoices/invoice.types";
import { EMPTY_CUSTOMER } from "@/modules/invoices/invoice.types";

export type VehicleRecord = VehicleSnapshot & { id: string };

export interface CustomerRecord extends CustomerSnapshot {
  id: string;
  vehicles: VehicleRecord[];
}

const CASE_INSENSITIVE = { locale: "en", strength: 2 } as const;
const MAX_LIST = 200;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

function stripCustomer({ _id, phoneDigits: _digits, createdAt: _c, updatedAt: _u, ...snapshot }: CustomerDoc): CustomerSnapshot & { id: string } {
  return { id: _id, ...EMPTY_CUSTOMER, ...snapshot };
}

function stripVehicle({ _id, customerId: _owner, createdAt: _c, updatedAt: _u, ...snapshot }: VehicleDoc): VehicleRecord {
  return { id: _id, ...snapshot };
}

async function withVehicles(c: Collections, customers: CustomerDoc[]): Promise<CustomerRecord[]> {
  const vehicles = await c.vehicles
    .find({ customerId: { $in: customers.map((customer) => customer._id) } })
    .sort({ updatedAt: -1 })
    .limit(MAX_LIST * 5)
    .toArray();
  return customers.map((customer) => ({
    ...stripCustomer(customer),
    vehicles: vehicles.filter((vehicle) => vehicle.customerId === customer._id).map(stripVehicle),
  }));
}

export async function searchCustomers(rawQuery: string, limit = 10): Promise<CustomerRecord[]> {
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

  const customers = await c.customers.find({ $or: filters }).sort({ updatedAt: -1 }).limit(Math.min(limit, MAX_LIST)).toArray();
  return withVehicles(c, customers);
}

export async function listCustomers(query: string): Promise<CustomerRecord[]> {
  if (query.trim().length >= 2) return searchCustomers(query, MAX_LIST);
  const c = await db();
  const customers = await c.customers.find({}).sort({ updatedAt: -1 }).limit(MAX_LIST).toArray();
  return withVehicles(c, customers);
}

export async function getCustomer(id: string): Promise<CustomerRecord> {
  const c = await db();
  const customer = await c.customers.findOne({ _id: id });
  if (!customer) throw notFound("Customer");
  return (await withVehicles(c, [customer]))[0]!;
}

export async function createCustomer(snapshot: CustomerSnapshot): Promise<CustomerRecord> {
  const c = await db();
  const now = new Date();
  const id = crypto.randomUUID();
  await c.customers.insertOne({ _id: id, ...snapshot, phoneDigits: phoneDigits(snapshot.phone), createdAt: now, updatedAt: now });
  return getCustomer(id);
}

// Invoices store their own customer/vehicle snapshot, so editing or deleting records never changes issued invoices.
export async function updateCustomer(id: string, snapshot: CustomerSnapshot): Promise<CustomerRecord> {
  const c = await db();
  const result = await c.customers.updateOne({ _id: id }, { $set: { ...snapshot, phoneDigits: phoneDigits(snapshot.phone), updatedAt: new Date() } });
  if (result.matchedCount === 0) throw notFound("Customer");
  return getCustomer(id);
}

export async function deleteCustomer(id: string): Promise<void> {
  const c = await db();
  const result = await c.customers.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw notFound("Customer");
  await c.vehicles.deleteMany({ customerId: id });
}

export async function createVehicle(customerId: string, snapshot: VehicleSnapshot): Promise<VehicleRecord> {
  const c = await db();
  if (!(await c.customers.findOne({ _id: customerId }, { projection: { _id: 1 } }))) throw notFound("Customer");
  const now = new Date();
  const doc: VehicleDoc = { _id: crypto.randomUUID(), ...snapshot, customerId, createdAt: now, updatedAt: now };
  await c.vehicles.insertOne(doc);
  return stripVehicle(doc);
}

export async function updateVehicle(id: string, snapshot: VehicleSnapshot): Promise<VehicleRecord> {
  const c = await db();
  const doc = await c.vehicles.findOneAndUpdate({ _id: id }, { $set: { ...snapshot, updatedAt: new Date() } }, { returnDocument: "after" });
  if (!doc) throw notFound("Vehicle");
  return stripVehicle(doc);
}

export async function deleteVehicle(id: string): Promise<void> {
  const result = await (await db()).vehicles.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw notFound("Vehicle");
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

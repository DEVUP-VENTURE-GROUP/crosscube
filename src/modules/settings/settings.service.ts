import type { Collections } from "@/lib/db/collections";
import { db } from "@/lib/db/mongo";
import { validationFailed } from "@/lib/errors/app-error";
import { DEFAULT_SETTINGS, type ShopSettings, type ShopSettingsInput } from "./settings.types";

export async function readSettings(c: Collections): Promise<ShopSettingsInput & { updatedAt: Date | null }> {
  const doc = await c.settings.findOne({ _id: "shop" });
  if (!doc) return { ...DEFAULT_SETTINGS, updatedAt: null };
  const { _id, ...settings } = doc;
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function getSettings(): Promise<ShopSettings> {
  const c = await db();
  const [settings, counter] = await Promise.all([readSettings(c), c.counters.findOne({ _id: "invoice" })]);
  return { ...settings, updatedAt: settings.updatedAt?.toISOString() ?? null, nextInvoiceNumber: counter?.next ?? 1 };
}

export async function updateSettings(input: ShopSettingsInput, nextInvoiceNumber: number | undefined): Promise<ShopSettings> {
  const c = await db();
  await c.settings.updateOne({ _id: "shop" }, { $set: { ...input, updatedAt: new Date() } }, { upsert: true });
  if (nextInvoiceNumber !== undefined) {
    const counter = await c.counters.findOne({ _id: "invoice" });
    const current = counter?.next ?? 1;
    if (nextInvoiceNumber < current) {
      const message = `Next invoice number cannot go below ${current}; lowering it could create duplicate numbers.`;
      throw validationFailed(message, [{ severity: "error", path: "nextInvoiceNumber", message }]);
    }
    // $max keeps the raise safe against a finalize incrementing the counter concurrently.
    await c.counters.updateOne({ _id: "invoice" }, { $max: { next: nextInvoiceNumber } }, { upsert: true });
  }
  return getSettings();
}

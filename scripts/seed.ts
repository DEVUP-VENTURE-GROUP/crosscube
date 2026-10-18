import type { Collections } from "../src/lib/db/collections";
import { DEMO_CATALOG, DEMO_SETTINGS, DEMO_TAX_CATEGORY, demoDraft } from "../src/modules/demo/demo-data";
import { createDraft } from "../src/modules/invoices/invoice.service";
import { connectFromEnv } from "./cli-db";

export async function seedDemoData(c: Collections): Promise<void> {
  const now = new Date();
  const { id: taxId, ...tax } = DEMO_TAX_CATEGORY;
  await c.taxCategories.updateOne(
    { _id: taxId },
    { $setOnInsert: { ...tax, isDemo: true, createdAt: now, updatedAt: now } },
    { upsert: true },
  );
  for (const { id, ...item } of DEMO_CATALOG) {
    await c.catalogItems.updateOne(
      { _id: id },
      { $setOnInsert: { ...item, isDemo: true, createdAt: now, updatedAt: now } },
      { upsert: true },
    );
  }
  await c.settings.updateOne({ _id: "shop" }, { $setOnInsert: { ...DEMO_SETTINGS, updatedAt: now } }, { upsert: true });
  await createDraft("demo-seed-draft-0001", demoDraft(), true);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/seed.ts")) {
  const { collections, dbName, close } = await connectFromEnv();
  await seedDemoData(collections);
  console.log(`Demonstration catalog, settings and a demo draft are in database "${dbName}" (existing records were left unchanged).`);
  await close();
}

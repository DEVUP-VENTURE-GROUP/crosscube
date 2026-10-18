import { afterAll, beforeAll, inject } from "vitest";
import type { Collections } from "@/lib/db/collections";
import { connect, setDbForTesting } from "@/lib/db/mongo";
import { seedDemoData } from "../../scripts/seed";

export function useTestDatabase(): { c: () => Collections } {
  let collections: Collections | undefined;
  let state: ReturnType<typeof connect> | undefined;

  beforeAll(async () => {
    state = connect(inject("mongoUri"), `test_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`);
    setDbForTesting(state);
    collections = await state.ready;
    await seedDemoData(collections);
  });

  afterAll(async () => {
    if (state) {
      await (await state.ready).invoices.db.dropDatabase();
      await state.client.close();
    }
    setDbForTesting(undefined);
  });

  return {
    c: () => {
      if (!collections) throw new Error("Database not ready");
      return collections;
    },
  };
}

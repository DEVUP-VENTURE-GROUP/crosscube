import { MongoClient } from "mongodb";
import { collections, ensureIndexes, type Collections } from "./collections";

interface DbState {
  client: MongoClient;
  ready: Promise<Collections>;
}

const globalForDb = globalThis as typeof globalThis & { __autoInvoiceDb?: DbState };

export function connect(uri: string, dbName: string): DbState {
  const client = new MongoClient(uri, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 30_000,
    appName: "auto-invoice",
  });
  const ready = client.connect().then(async () => {
    const c = collections(client.db(dbName));
    await ensureIndexes(c);
    return c;
  });
  return { client, ready };
}

// Cached on globalThis so dev hot reloads reuse one connection pool.
export async function db(): Promise<Collections> {
  if (!globalForDb.__autoInvoiceDb) {
    const { serverEnv } = await import("@/lib/config/env");
    const env = serverEnv();
    const state = connect(env.MONGODB_URI, env.MONGODB_DB);
    state.ready.catch(() => {
      if (globalForDb.__autoInvoiceDb === state) globalForDb.__autoInvoiceDb = undefined;
    });
    globalForDb.__autoInvoiceDb = state;
  }
  return globalForDb.__autoInvoiceDb.ready;
}

export function setDbForTesting(state: DbState | undefined): void {
  globalForDb.__autoInvoiceDb = state;
}

import { connect, setDbForTesting } from "../src/lib/db/mongo";

export async function connectFromEnv() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // .env is optional when variables come from the environment
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Copy .env.example to .env and point it at your MongoDB deployment.");
  const dbName = process.env.MONGODB_DB || "auto_invoice";
  const state = connect(uri, dbName);
  setDbForTesting(state);
  const collections = await state.ready;
  return { collections, dbName, close: () => state.client.close() };
}

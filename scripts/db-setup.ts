import { connectFromEnv } from "./cli-db";

const { dbName, close } = await connectFromEnv();
console.log(`Indexes and invoice counter are in place in database "${dbName}".`);
await close();

import { spawn } from "node:child_process";
import { hashPassword } from "../src/lib/auth/password";
import { MongoMemoryServer } from "mongodb-memory-server";
import { connect, setDbForTesting } from "../src/lib/db/mongo";
import { seedDemoData } from "./seed";

const port = process.env.E2E_PORT ?? "3100";
const mongo = await MongoMemoryServer.create();
const uri = mongo.getUri();
const dbName = "auto_invoice_e2e";

const state = connect(uri, dbName);
setDbForTesting(state);
await seedDemoData(await state.ready);
await state.client.close();

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", port], {
  stdio: "inherit",
  env: {
    ...process.env,
    MONGODB_URI: uri,
    MONGODB_DB: dbName,
    AUTH_USERNAME: "e2e-admin",
    AUTH_PASSWORD_HASH: await hashPassword("e2e-correct-horse-battery"),
    AUTH_SECRET: "e2e-session-secret-0123456789abcdef0123456789",
    ALLOW_UNAUTHENTICATED: "false",
  },
});

const shutdown = async () => {
  server.kill();
  await mongo.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
server.on("exit", () => void mongo.stop());

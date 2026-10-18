import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { hashPassword } from "../src/lib/auth/password";

const fromArg = process.argv[2];
const password =
  fromArg ??
  (await (async () => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question("New password: ");
    rl.close();
    return answer;
  })());

if (password.length < 12) {
  console.error("Use at least 12 characters.");
  process.exit(1);
}

console.log(`AUTH_PASSWORD_HASH="${await hashPassword(password)}"`);
console.log(`AUTH_SECRET="${randomBytes(32).toString("base64url")}"   # only needed once; changing it signs everyone out`);

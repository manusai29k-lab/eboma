import "dotenv/config";
import * as readline from "node:readline";
import { getDb, getAdminByUsername, updateAdminPasscode } from "../db";
import { hashPassword } from "../lib/password";

// Updates an existing admin's passcode to a bcrypt hash. The new passcode is
// entered interactively (masked, not echoed) - it is never logged, never
// written to a file, and never passed as a CLI argument or env var (which
// would leak into shell history / process listings).
//
// Usage:
//   npx tsx server/scripts/updateAdminPasscode.ts [username]
// `username` defaults to "admin".
const USERNAME = process.argv[2] ?? "admin";

// Node's readline has no built-in masked-input mode; muting the interface's
// internal output write is the standard workaround (used by npm, yarn, etc.)
// in the absence of a dedicated password-prompt package.
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let muted = false;
    // @ts-expect-error - _writeToOutput is a private readline API; this is the standard masking workaround.
    rl._writeToOutput = (str: string) => {
      if (!muted) process.stdout.write(str);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    muted = true;
  });
}

async function main() {
  const newPasscode = await promptHidden("New admin passcode: ");
  if (!newPasscode || newPasscode.length < 4) {
    console.error("Passcode must be at least 4 characters.");
    process.exit(1);
  }
  const confirmPasscode = await promptHidden("Confirm new admin passcode: ");
  if (newPasscode !== confirmPasscode) {
    console.error("Passcodes did not match.");
    process.exit(1);
  }

  const db = await getDb();
  if (!db) {
    console.error("DATABASE_URL is not set or the database is unavailable.");
    process.exit(1);
  }

  const admin = await getAdminByUsername(USERNAME);
  if (!admin) {
    console.error(`Admin "${USERNAME}" not found.`);
    process.exit(1);
  }

  const hashed = await hashPassword(newPasscode);
  await updateAdminPasscode(admin.id, hashed);
  console.log(`Updated passcode for admin "${USERNAME}" (id=${admin.id}).`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

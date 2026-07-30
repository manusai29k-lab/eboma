import { eq } from "drizzle-orm";
import { admins } from "../../drizzle/schema";
import { getDb } from "../db";
import { hashPassword } from "../lib/password";

// One-time seed for a test admin account. Run after `pnpm db:push` has created
// the `admins` table: `npx tsx server/scripts/seedAdmin.ts`
const USERNAME = "admin";
const PASSCODE = "Admin@2026";
const NAME = "IBRAHIM WALEED";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("DATABASE_URL is not set or the database is unavailable.");
    process.exit(1);
  }

  const existing = await db.select().from(admins).where(eq(admins.username, USERNAME)).limit(1);
  if (existing.length > 0) {
    console.log(`Admin "${USERNAME}" already exists (id=${existing[0].id}). Nothing to do.`);
    return;
  }

  const hashed = await hashPassword(PASSCODE);
  await db.insert(admins).values({ username: USERNAME, passcode: hashed, name: NAME });
  console.log(`Created admin account -> username: "${USERNAME}", passcode: "${PASSCODE}"`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

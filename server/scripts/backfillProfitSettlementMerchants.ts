import "dotenv/config";
import { eq } from "drizzle-orm";
import { profitSettlements, profitSettlementMerchants } from "../../drizzle/schema";
import { getDb } from "../db";

// One-time backfill for profit_settlement_merchants: every profitSettlements
// row created before this table existed has no corresponding link row, which
// would make it silently disappear from db.getProfitSettlementsByMerchant
// (mySettlements/mySubordinates) once that function switches to reading this
// table instead of profitSettlements.merchantId directly. This inserts
// exactly one link row per existing settlement (settlementId, its own
// merchantId) so historical settlements keep showing up for the merchant
// they were originally created for.
//
// Idempotent - skips any settlement that already has at least one link row,
// so it's safe to run more than once (e.g. if new settlements were created
// between runs, they already get their link row(s) written by
// db.createProfitSettlement itself and are skipped here).
//
// Run exactly once, immediately after `pnpm db:push`:
//   npx tsx server/scripts/backfillProfitSettlementMerchants.ts
async function main() {
  const db = await getDb();
  if (!db) {
    console.error("DATABASE_URL is not set or the database is unavailable.");
    process.exit(1);
  }

  const allSettlements = await db.select().from(profitSettlements);
  let inserted = 0;
  let skipped = 0;

  for (const settlement of allSettlements) {
    const existing = await db.select().from(profitSettlementMerchants)
      .where(eq(profitSettlementMerchants.settlementId, settlement.id))
      .limit(1);
    if (existing.length > 0) {
      skipped++;
      continue;
    }
    await db.insert(profitSettlementMerchants).values({
      settlementId: settlement.id,
      merchantId: settlement.merchantId,
    });
    inserted++;
  }

  console.log(`Backfilled profit_settlement_merchants: ${inserted} inserted, ${skipped} already had a link row (skipped).`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

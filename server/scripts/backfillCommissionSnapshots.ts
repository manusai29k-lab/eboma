import { and, eq } from "drizzle-orm";
import { digitalSales, merchants, physicalOrders } from "../../drizzle/schema";
import { getDb } from "../db";

// One-time backfill for physical_orders.commissionAtOrderTime and
// digital_sales.digitalLevelAtSaleTime on rows created before these columns
// existed. Approximates historical rows using each merchant's CURRENT
// commission/digitalLevel at the moment this script runs — it cannot recover
// what the merchant's commission/level actually was back when each historical
// order/sale was made, so this is best-effort for old data only.
//
// Run exactly once, immediately after `pnpm db:push` and before any new
// orders/sales are created or any merchant's commission/level is changed:
//   npx tsx server/scripts/backfillCommissionSnapshots.ts
//
// Physical orders are only touched while still at the migration's default (0),
// so re-running this after real orders exist won't clobber their real frozen
// values. Digital sales have no safe "unset" marker (level "1" is a legitimate
// real value), so only run this once, right after the migration.
async function main() {
  const db = await getDb();
  if (!db) {
    console.error("DATABASE_URL is not set or the database is unavailable.");
    process.exit(1);
  }

  const allMerchants = await db.select().from(merchants);

  for (const merchant of allMerchants) {
    await db.update(physicalOrders)
      .set({ commissionAtOrderTime: merchant.commission })
      .where(and(
        eq(physicalOrders.merchantId, merchant.id),
        eq(physicalOrders.commissionAtOrderTime, 0),
      ));

    await db.update(digitalSales)
      .set({ digitalLevelAtSaleTime: merchant.digitalLevel })
      .where(eq(digitalSales.merchantId, merchant.id));
  }

  console.log(`Backfilled commissionAtOrderTime / digitalLevelAtSaleTime for ${allMerchants.length} merchant(s)' historical rows.`);
  console.log("Note: this approximates old rows with each merchant's CURRENT commission/level — it is not exact history.");
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

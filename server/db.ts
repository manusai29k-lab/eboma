import { eq, desc, and, gte, lte, sql, like, or, count, sum } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  Merchant, merchants,
  Admin, admins,
  PhysicalProduct, physicalProducts,
  DigitalProduct, digitalProducts,
  PhysicalOrder, physicalOrders,
  DigitalSale, digitalSales,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== User (Manus OAuth) ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== Merchants ====================

export async function createMerchantByAdmin(data: {
  name: string;
  username: string;
  passcode: string;
  merchantType: "physical" | "digital";
  commission: number; // fixed IQD per order for physical merchants
  digitalLevel: "1" | "2" | "3"; // commission level for digital merchants
}): Promise<Merchant> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(merchants).where(eq(merchants.username, data.username)).limit(1);
  if (existing.length > 0) {
    throw new Error("اسم المستخدم مسجل بالفعل");
  }
  await db.insert(merchants).values({
    name: data.name,
    username: data.username,
    passcode: data.passcode,
    merchantType: data.merchantType,
    commission: data.commission,
    digitalLevel: data.digitalLevel,
  });
  const [created] = await db.select().from(merchants).where(eq(merchants.username, data.username)).limit(1);
  return created;
}

export async function getMerchantByUsername(username: string): Promise<Merchant | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(merchants).where(eq(merchants.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function incrementFailedAttempts(id: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [merchant] = await db.select().from(merchants).where(eq(merchants.id, id)).limit(1);
  const attempts = (merchant?.failedAttempts ?? 0) + 1;
  await db.update(merchants).set({ failedAttempts: attempts }).where(eq(merchants.id, id));
  if (attempts >= 5) {
    const lockUntil = new Date();
    lockUntil.setMinutes(lockUntil.getMinutes() + 15); // lock for 15 minutes
    await db.update(merchants).set({ lockedUntil: lockUntil }).where(eq(merchants.id, id));
  }
  return attempts;
}

export async function resetFailedAttempts(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(merchants).set({ failedAttempts: 0, lockedUntil: null }).where(eq(merchants.id, id));
}

export async function updateMerchantLevel(id: number, level: "1" | "2" | "3"): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(merchants).set({ digitalLevel: level }).where(eq(merchants.id, id));
}

export async function updateMerchantPasscode(id: number, newPasscode: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(merchants).set({
    passcode: newPasscode,
    failedAttempts: 0,
    lockedUntil: null,
  }).where(eq(merchants.id, id));
}

export async function getMerchantById(id: number): Promise<Merchant | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(merchants).where(eq(merchants.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateMerchantLastSignIn(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(merchants).set({ lastSignedIn: new Date() }).where(eq(merchants.id, id));
}

export async function getAllMerchants(): Promise<Merchant[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(merchants).orderBy(desc(merchants.createdAt));
  return result;
}

export async function deleteMerchant(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(merchants).where(eq(merchants.id, id));
}

// ==================== Admins (internal admin auth) ====================

export async function getAdminByUsername(username: string): Promise<Admin | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(admins).where(eq(admins.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAdminById(id: number): Promise<Admin | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(admins).where(eq(admins.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function incrementAdminFailedAttempts(id: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [admin] = await db.select().from(admins).where(eq(admins.id, id)).limit(1);
  const attempts = (admin?.failedAttempts ?? 0) + 1;
  await db.update(admins).set({ failedAttempts: attempts }).where(eq(admins.id, id));
  if (attempts >= 5) {
    const lockUntil = new Date();
    lockUntil.setMinutes(lockUntil.getMinutes() + 15); // lock for 15 minutes
    await db.update(admins).set({ lockedUntil: lockUntil }).where(eq(admins.id, id));
  }
  return attempts;
}

export async function resetAdminFailedAttempts(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(admins).set({ failedAttempts: 0, lockedUntil: null }).where(eq(admins.id, id));
}

// ==================== Physical Products ====================

export async function createPhysicalProduct(data: { name: string; price: number; type: string; description?: string }): Promise<PhysicalProduct> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(physicalProducts).values(data);
  const [created] = await db.select().from(physicalProducts).orderBy(desc(physicalProducts.id)).limit(1);
  return created;
}

export async function getAllPhysicalProducts(): Promise<PhysicalProduct[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(physicalProducts).orderBy(desc(physicalProducts.createdAt));
}

export async function updatePhysicalProduct(id: number, data: Partial<{ name: string; price: number; type: string; description?: string }>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(physicalProducts).set(data).where(eq(physicalProducts.id, id));
}

export async function deletePhysicalProduct(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(physicalProducts).where(eq(physicalProducts.id, id));
}

// ==================== Digital Products ====================

export async function createDigitalProduct(data: { name: string; price: number; type: string; description?: string }): Promise<DigitalProduct> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(digitalProducts).values(data);
  const [created] = await db.select().from(digitalProducts).orderBy(desc(digitalProducts.id)).limit(1);
  return created;
}

export async function getAllDigitalProducts(): Promise<DigitalProduct[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(digitalProducts).orderBy(desc(digitalProducts.createdAt));
}

export async function updateDigitalProduct(id: number, data: Partial<{ name: string; price: number; type: string; description?: string }>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(digitalProducts).set(data).where(eq(digitalProducts.id, id));
}

export async function deleteDigitalProduct(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(digitalProducts).where(eq(digitalProducts.id, id));
}

// ==================== Physical Orders ====================

export async function createPhysicalOrder(data: {
  merchantId: number;
  merchantName: string;
  customerName: string;
  customerPhone: string;
  productType: string;
  productPrice: number;
  quantity: number;
  totalPrice: number;
  province: string;
  district: string;
  notes?: string;
  commissionAtOrderTime: number;
}): Promise<PhysicalOrder> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(physicalOrders).values(data);
  const [created] = await db.select().from(physicalOrders).orderBy(desc(physicalOrders.id)).limit(1);
  return created;
}

export async function getPhysicalOrdersByMerchant(merchantId: number): Promise<PhysicalOrder[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(physicalOrders).where(eq(physicalOrders.merchantId, merchantId)).orderBy(desc(physicalOrders.createdAt));
}

export async function getAllPhysicalOrders(): Promise<PhysicalOrder[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(physicalOrders).orderBy(desc(physicalOrders.createdAt));
}

export async function updatePhysicalOrderStatus(id: number, status: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(physicalOrders).set({ status: status as any }).where(eq(physicalOrders.id, id));
}

export async function getFilteredPhysicalOrders(filters: {
  merchantId?: number;
  productType?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<PhysicalOrder[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.merchantId) conditions.push(eq(physicalOrders.merchantId, filters.merchantId));
  if (filters.productType) conditions.push(eq(physicalOrders.productType, filters.productType));
  if (filters.status) conditions.push(eq(physicalOrders.status, filters.status as any));
  if (filters.startDate) conditions.push(gte(physicalOrders.createdAt, filters.startDate));
  if (filters.endDate) conditions.push(lte(physicalOrders.createdAt, filters.endDate));
  if (conditions.length === 0) {
    return await db.select().from(physicalOrders).orderBy(desc(physicalOrders.createdAt));
  }
  return await db.select().from(physicalOrders).where(and(...conditions)).orderBy(desc(physicalOrders.createdAt));
}

// ==================== Digital Sales ====================

export async function createDigitalSale(data: {
  merchantId: number;
  merchantName: string;
  customerPhone: string;
  productType: string;
  productPrice: number;
  proofImageKey?: string;
  proofImageUrl?: string;
  digitalLevelAtSaleTime: "1" | "2" | "3";
}): Promise<DigitalSale> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(digitalSales).values(data);
  const [created] = await db.select().from(digitalSales).orderBy(desc(digitalSales.id)).limit(1);
  return created;
}

export async function getDigitalSalesByMerchant(merchantId: number): Promise<DigitalSale[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(digitalSales).where(eq(digitalSales.merchantId, merchantId)).orderBy(desc(digitalSales.createdAt));
}

export async function getAllDigitalSales(): Promise<DigitalSale[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(digitalSales).orderBy(desc(digitalSales.createdAt));
}

export async function getFilteredDigitalSales(filters: {
  merchantId?: number;
  productType?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<DigitalSale[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.merchantId) conditions.push(eq(digitalSales.merchantId, filters.merchantId));
  if (filters.productType) conditions.push(eq(digitalSales.productType, filters.productType));
  if (filters.status) conditions.push(eq(digitalSales.status, filters.status as any));
  if (filters.startDate) conditions.push(gte(digitalSales.createdAt, filters.startDate));
  if (filters.endDate) conditions.push(lte(digitalSales.createdAt, filters.endDate));
  if (conditions.length === 0) {
    return await db.select().from(digitalSales).orderBy(desc(digitalSales.createdAt));
  }
  return await db.select().from(digitalSales).where(and(...conditions)).orderBy(desc(digitalSales.createdAt));
}

// ==================== Dashboard Stats ====================

// Single source of truth for the digital commission percentage. Always called
// with a *frozen* digitalLevelAtSaleTime (never merchant.digitalLevel), so a
// later level upgrade can't retroactively change a past sale's payout.
export function digitalLevelToPercent(level: "1" | "2" | "3"): number {
  return level === "3" ? 0.5 : level === "2" ? 0.4 : 0.3;
}

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { totalPhysicalOrders: 0, totalDigitalSales: 0, totalRevenue: 0, totalMerchants: 0, totalMerchantEarnings: 0, totalAdminProfit: 0, returnedOrders: 0, cancelledOrders: 0 };

  const [physCount] = await db.select({ value: count() }).from(physicalOrders);
  const [digiCount] = await db.select({ value: count() }).from(digitalSales);
  const [physRevenue] = await db.select({ value: sum(physicalOrders.totalPrice) }).from(physicalOrders).where(eq(physicalOrders.status, "delivered"));
  const [digiRevenue] = await db.select({ value: sum(digitalSales.productPrice) }).from(digitalSales).where(eq(digitalSales.status, "delivered"));
  const [merchCount] = await db.select({ value: count() }).from(merchants);
  const [returnedCount] = await db.select({ value: count() }).from(physicalOrders).where(eq(physicalOrders.status, "returned"));
  const [cancelledCount] = await db.select({ value: count() }).from(physicalOrders).where(eq(physicalOrders.status, "cancelled"));

  const physRev = physRevenue?.value ? Number(physRevenue.value) : 0;
  const digiRev = digiRevenue?.value ? Number(digiRevenue.value) : 0;

  // Merchant earnings use each order/sale's own frozen commission/level
  // (commissionAtOrderTime / digitalLevelAtSaleTime), never the merchant's
  // current commission/digitalLevel — a commission upgrade must only apply to
  // orders/sales created after the upgrade, not existing ones.
  const [physEarningsRow] = await db.select({ value: sum(physicalOrders.commissionAtOrderTime) }).from(physicalOrders).where(eq(physicalOrders.status, "delivered"));
  const deliveredDigitalSales = await db.select({
    productPrice: digitalSales.productPrice,
    digitalLevelAtSaleTime: digitalSales.digitalLevelAtSaleTime,
  }).from(digitalSales).where(eq(digitalSales.status, "delivered"));

  const digiEarnings = deliveredDigitalSales.reduce(
    (acc, sale) => acc + Math.floor(sale.productPrice * digitalLevelToPercent(sale.digitalLevelAtSaleTime)),
    0,
  );

  const totalMerchantEarnings = (physEarningsRow?.value ? Number(physEarningsRow.value) : 0) + digiEarnings;
  const totalAdminProfit = (physRev + digiRev) - totalMerchantEarnings;

  return {
    totalPhysicalOrders: physCount?.value ?? 0,
    totalDigitalSales: digiCount?.value ?? 0,
    totalRevenue: physRev + digiRev,
    totalMerchants: merchCount?.value ?? 0,
    totalMerchantEarnings,
    totalAdminProfit,
    returnedOrders: returnedCount?.value ?? 0,
    cancelledOrders: cancelledCount?.value ?? 0,
  };
}

export async function getMerchantPerformance() {
  const db = await getDb();
  if (!db) return [];

  const allMerchants = await db.select().from(merchants).orderBy(desc(merchants.createdAt));
  const result = [];

  for (const merchant of allMerchants) {
    // Physical orders - exclude returned and cancelled from commission calculation
    const [physCount] = await db.select({ value: count() }).from(physicalOrders).where(eq(physicalOrders.merchantId, merchant.id));
    const [physDeliveredCount] = await db.select({ value: count() }).from(physicalOrders).where(and(
      eq(physicalOrders.merchantId, merchant.id),
      eq(physicalOrders.status, "delivered"),
    ));
    const [physReturnedCount] = await db.select({ value: count() }).from(physicalOrders).where(and(
      eq(physicalOrders.merchantId, merchant.id),
      eq(physicalOrders.status, "returned"),
    ));
    const [physCancelledCount] = await db.select({ value: count() }).from(physicalOrders).where(and(
      eq(physicalOrders.merchantId, merchant.id),
      eq(physicalOrders.status, "cancelled"),
    ));
    const [physRev] = await db.select({ value: sum(physicalOrders.totalPrice) }).from(physicalOrders).where(and(
      eq(physicalOrders.merchantId, merchant.id),
      eq(physicalOrders.status, "delivered"),
    ));
    // Sum of each order's own frozen commission (commissionAtOrderTime), not
    // deliveredCount * merchant.commission — the current commission must never
    // be applied retroactively to orders created under a different commission.
    const [physEarningsRow] = await db.select({ value: sum(physicalOrders.commissionAtOrderTime) }).from(physicalOrders).where(and(
      eq(physicalOrders.merchantId, merchant.id),
      eq(physicalOrders.status, "delivered"),
    ));

    // Digital sales
    const [digiCount] = await db.select({ value: count() }).from(digitalSales).where(eq(digitalSales.merchantId, merchant.id));
    const [digiDeliveredCount] = await db.select({ value: count() }).from(digitalSales).where(and(
      eq(digitalSales.merchantId, merchant.id),
      eq(digitalSales.status, "delivered"),
    ));
    const [digiRev] = await db.select({ value: sum(digitalSales.productPrice) }).from(digitalSales).where(and(
      eq(digitalSales.merchantId, merchant.id),
      eq(digitalSales.status, "delivered"),
    ));
    // Same freeze for digital sales: each row's own digitalLevelAtSaleTime, not
    // the merchant's current digitalLevel.
    const deliveredDigitalSales = await db.select({
      productPrice: digitalSales.productPrice,
      digitalLevelAtSaleTime: digitalSales.digitalLevelAtSaleTime,
    }).from(digitalSales).where(and(
      eq(digitalSales.merchantId, merchant.id),
      eq(digitalSales.status, "delivered"),
    ));

    const physRevNum = physRev?.value ? Number(physRev.value) : 0;
    const digiRevNum = digiRev?.value ? Number(digiRev.value) : 0;

    // Calculate commission/earnings
    let merchantEarnings = 0;
    let adminProfit = 0;
    if (merchant.merchantType === "physical") {
      // Physical: sum of each delivered order's frozen commission
      merchantEarnings = physEarningsRow?.value ? Number(physEarningsRow.value) : 0;
      adminProfit = physRevNum - merchantEarnings;
    } else {
      // Digital: each delivered sale's own frozen level percentage
      merchantEarnings = deliveredDigitalSales.reduce(
        (acc, sale) => acc + Math.floor(sale.productPrice * digitalLevelToPercent(sale.digitalLevelAtSaleTime)),
        0,
      );
      adminProfit = digiRevNum - merchantEarnings;
    }

    result.push({
      id: merchant.id,
      name: merchant.name,
      username: merchant.username,
      merchantType: merchant.merchantType,
      commission: merchant.commission,
      digitalLevel: merchant.digitalLevel,
      physicalOrders: physCount?.value ?? 0,
      physicalDelivered: physDeliveredCount?.value ?? 0,
      physicalReturned: physReturnedCount?.value ?? 0,
      physicalCancelled: physCancelledCount?.value ?? 0,
      digitalSales: digiCount?.value ?? 0,
      digitalDelivered: digiDeliveredCount?.value ?? 0,
      totalOrders: (physCount?.value ?? 0) + (digiCount?.value ?? 0),
      totalRevenue: physRevNum + digiRevNum,
      merchantEarnings,
      adminProfit,
      createdAt: merchant.createdAt,
      lastSignedIn: merchant.lastSignedIn,
    });
  }

  return result;
}

export async function getDailySalesStats(days: number = 30) {
  const db = await getDb();
  if (!db) return [];

  const result = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(now.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    // Revenue follows the same delivered-only rule as getDashboardStats /
    // getMerchantPerformance: physical orders only count once actually
    // delivered, while digital sales count as soon as confirmed (they default
    // to "delivered" at creation since there's no physical delivery step —
    // this only excludes ones later marked "cancelled").
    const [physRev] = await db.select({ value: sum(physicalOrders.totalPrice) })
      .from(physicalOrders)
      .where(and(
        gte(physicalOrders.createdAt, dayStart),
        lte(physicalOrders.createdAt, dayEnd),
        eq(physicalOrders.status, "delivered")
      ));
    const [digiRev] = await db.select({ value: sum(digitalSales.productPrice) })
      .from(digitalSales)
      .where(and(
        gte(digitalSales.createdAt, dayStart),
        lte(digitalSales.createdAt, dayEnd),
        eq(digitalSales.status, "delivered")
      ));
    const [physCount] = await db.select({ value: count() })
      .from(physicalOrders)
      .where(and(
        gte(physicalOrders.createdAt, dayStart),
        lte(physicalOrders.createdAt, dayEnd)
      ));
    const [digiCount] = await db.select({ value: count() })
      .from(digitalSales)
      .where(and(
        gte(digitalSales.createdAt, dayStart),
        lte(digitalSales.createdAt, dayEnd)
      ));

    result.push({
      date: dayStart.toISOString().split("T")[0],
      physicalRevenue: physRev?.value ? Number(physRev.value) : 0,
      digitalRevenue: digiRev?.value ? Number(digiRev.value) : 0,
      physicalOrders: physCount?.value ?? 0,
      digitalSales: digiCount?.value ?? 0,
      totalRevenue: (physRev?.value ? Number(physRev.value) : 0) + (digiRev?.value ? Number(digiRev.value) : 0),
    });
  }

  return result;
}

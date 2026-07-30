import { eq, desc, and, gte, lte, sql, like, or, count, sum, isNull, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  Merchant, merchants,
  Admin, admins,
  PhysicalProduct, physicalProducts,
  DigitalProduct, digitalProducts,
  PhysicalOrder, physicalOrders,
  DigitalSale, digitalSales,
  Settlement, settlements,
  ProfitSettlement, profitSettlements,
  ProfitSettlementShare, profitSettlementShares,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { checkParentAssignment } from "@shared/merchantHierarchy";

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

const PARENT_ASSIGNMENT_ERROR_MESSAGES: Record<
  Exclude<ReturnType<typeof checkParentAssignment>, { allowed: true }>["reason"],
  string
> = {
  parentIsSalesRep: "مندوب المبيعات لا يقبل أي تابع",
  supervisorCommissionTooHigh: "لا يمكن أن تكون عمولة المشرف التابع أعلى من عمولة المشرف الذي يتبع له",
  supervisorRejectsRole: "المشرف يقبل فقط مندوبي مبيعات، أو مشرفين آخرين بعمولة لا تتجاوز عمولته",
  leaderRejectsRole: "القائد يقبل فقط مشرفين أو قادة آخرين كتابعين",
};

// Thin wrapper around checkParentAssignment (shared/merchantHierarchy.ts) -
// that function is the single source of truth for the sales_rep->supervisor->
// leader->manager hierarchy rules, shared with the admin "يتبع لـ" combobox
// filter. This wrapper only adds the Arabic error messages for the server's
// throw-on-invalid convention.
export function validateParentAssignment(
  childRole: Merchant["role"],
  childCommissionValue: number,
  parent: Merchant,
): void {
  const result = checkParentAssignment(childRole, childCommissionValue, parent);
  if (!result.allowed) {
    throw new Error(PARENT_ASSIGNMENT_ERROR_MESSAGES[result.reason]);
  }
}

export async function createMerchantByAdmin(data: {
  name: string;
  username: string;
  passcode: string;
  merchantType: "physical" | "digital";
  commission: number; // fixed IQD per order for physical merchants
  digitalLevel: "1" | "2" | "3"; // commission level for digital merchants
  role: Merchant["role"];
  parentId: number | null;
  commissionType: Merchant["commissionType"];
  commissionValue: number;
  overridePercentage: number | null; // manager role only, see updateMerchantByAdmin
  canViewCosts: boolean; // whether merchant sees cost/profit fields on own orders
}): Promise<Merchant> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(merchants).where(eq(merchants.username, data.username)).limit(1);
  if (existing.length > 0) {
    throw new Error("اسم المستخدم مسجل بالفعل");
  }

  if (data.parentId != null) {
    const parent = await getMerchantById(data.parentId);
    if (!parent) throw new Error("التاجر الذي يُفترض اتباعه غير موجود");
    validateParentAssignment(data.role, data.commissionValue, parent);
  }

  await db.insert(merchants).values({
    name: data.name,
    username: data.username,
    passcode: data.passcode,
    merchantType: data.merchantType,
    commission: data.commission,
    digitalLevel: data.digitalLevel,
    role: data.role,
    parentId: data.parentId,
    commissionType: data.commissionType,
    commissionValue: data.commissionValue,
    // overridePercentage means a share of the hierarchical profit-sharing
    // common base (see calculateProfitShares) - any role above sales_rep can
    // hold one (supervisor/leader/manager), never persisted for sales_rep,
    // same rule enforced in updateMerchantByAdmin below.
    overridePercentage: data.role !== "sales_rep" ? data.overridePercentage : null,
    // Unlike overridePercentage, canViewCosts isn't gated by role - admin
    // can grant it to any merchant regardless of hierarchy position.
    canViewCosts: data.canViewCosts,
  });
  const [created] = await db.select().from(merchants).where(eq(merchants.username, data.username)).limit(1);
  return created;
}

// Admin edits an existing merchant's profile + hierarchy/commission settings.
// Username/passcode are intentionally excluded - they have their own
// dedicated flows (login identity, resetPassword) and aren't part of this form.
export async function updateMerchantByAdmin(id: number, data: {
  name: string;
  merchantType: "physical" | "digital";
  commission: number;
  digitalLevel: "1" | "2" | "3";
  role: Merchant["role"];
  parentId: number | null;
  commissionType: Merchant["commissionType"];
  commissionValue: number;
  overridePercentage: number | null;
  canViewCosts: boolean;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (data.parentId === id) {
    throw new Error("لا يمكن أن يتبع التاجر لنفسه");
  }

  if (data.parentId != null) {
    const parent = await getMerchantById(data.parentId);
    if (!parent) throw new Error("التاجر الذي يُفترض اتباعه غير موجود");
    validateParentAssignment(data.role, data.commissionValue, parent);
  }

  await db.update(merchants).set({
    name: data.name,
    merchantType: data.merchantType,
    commission: data.commission,
    digitalLevel: data.digitalLevel,
    role: data.role,
    parentId: data.parentId,
    commissionType: data.commissionType,
    commissionValue: data.commissionValue,
    overridePercentage: data.role !== "sales_rep" ? data.overridePercentage : null,
    canViewCosts: data.canViewCosts,
  }).where(eq(merchants.id, id));
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

// Flat list for the admin org-chart page - only the fields needed to draw
// the tree client-side from parentId. No recursive SQL, no nesting here.
export async function getMerchantsOrgTree(): Promise<Array<{
  id: number;
  name: string;
  role: Merchant["role"];
  parentId: number | null;
  commissionType: Merchant["commissionType"];
  commissionValue: number;
}>> {
  const db = await getDb();
  if (!db) return [];
  return await db.select({
    id: merchants.id,
    name: merchants.name,
    role: merchants.role,
    parentId: merchants.parentId,
    commissionType: merchants.commissionType,
    commissionValue: merchants.commissionValue,
  }).from(merchants).orderBy(merchants.name);
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

// hashedPasscode must already be a bcrypt hash (see server/lib/password.ts) -
// this function does no hashing itself, same as every other admins.passcode write here.
export async function updateAdminPasscode(id: number, hashedPasscode: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(admins).set({ passcode: hashedPasscode }).where(eq(admins.id, id));
}

// ==================== Physical Products ====================

export async function createPhysicalProduct(data: { name: string; price: number; type: string; description?: string; stock?: number; imageKey?: string; imageUrl?: string; wholesaleCost?: number; deliveryCost?: number }): Promise<PhysicalProduct> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(physicalProducts).values(data);
  const [created] = await db.select().from(physicalProducts).orderBy(desc(physicalProducts.id)).limit(1);
  return created;
}

// Public/merchant-facing — deliberately excludes `stock` at the SELECT level
// (not just hidden in the UI) so it can never leak through this endpoint.
export async function getAllPhysicalProducts(): Promise<Array<Pick<PhysicalProduct, "id" | "name" | "price" | "type" | "description" | "imageUrl" | "createdAt" | "updatedAt">>> {
  const db = await getDb();
  if (!db) return [];
  return await db.select({
    id: physicalProducts.id,
    name: physicalProducts.name,
    price: physicalProducts.price,
    type: physicalProducts.type,
    description: physicalProducts.description,
    imageUrl: physicalProducts.imageUrl,
    createdAt: physicalProducts.createdAt,
    updatedAt: physicalProducts.updatedAt,
  }).from(physicalProducts).orderBy(desc(physicalProducts.createdAt));
}

// Admin-only — full row including stock, for AdminProducts.tsx.
export async function getAllPhysicalProductsAdmin(): Promise<PhysicalProduct[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(physicalProducts).orderBy(desc(physicalProducts.createdAt));
}

export async function updatePhysicalProduct(id: number, data: Partial<{ name: string; price: number; type: string; description?: string; stock: number; imageKey: string; imageUrl: string; wholesaleCost: number; deliveryCost: number }>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(physicalProducts).set(data).where(eq(physicalProducts.id, id));
}

// Used only server-side by physicalOrders.create to look up cost fields for
// freezing onto the new order row - not exposed as its own procedure.
export async function getPhysicalProductById(id: number): Promise<PhysicalProduct | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(physicalProducts).where(eq(physicalProducts.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
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
  // Absolute IQD amount, frozen via computeFrozenCommission from the
  // merchant's commissionType/commissionValue at the moment of creation.
  commissionAtOrderTime: number;
  productId?: number;
  // Frozen via computeFrozenProductCosts from the linked product at the
  // moment of creation - default 0 when there's no linked product.
  wholesaleCostAtOrderTime?: number;
  deliveryCostAtOrderTime?: number;
  grossProfitAtOrderTime?: number;
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

export type MaskedPhysicalOrder = Omit<PhysicalOrder, "wholesaleCostAtOrderTime" | "deliveryCostAtOrderTime" | "grossProfitAtOrderTime">;

// Cost/profit fields are only visible to a merchant whose canViewCosts is
// true (admin-controlled per merchant, see merchants.canViewCosts) - the
// keys themselves are stripped from the returned object (not just nulled
// out) so they never appear in the response payload for a merchant without
// the flag, even via devtools/network inspection.
export function maskPhysicalOrderForMerchant(
  order: PhysicalOrder,
  canViewCosts: boolean,
): PhysicalOrder | MaskedPhysicalOrder {
  if (canViewCosts) return order;
  const { wholesaleCostAtOrderTime, deliveryCostAtOrderTime, grossProfitAtOrderTime, ...rest } = order;
  return rest;
}

export async function getAllPhysicalOrders(): Promise<PhysicalOrder[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(physicalOrders).orderBy(desc(physicalOrders.createdAt));
}

/**
 * Updates a physical order's status and, if it's linked to a catalog
 * product (productId set — i.e. the merchant picked it from the catalog
 * picker, not the free-text "إدخال يدوي" path), automatically adjusts that
 * product's stock. Reuses PHYSICAL_TERMINAL_STATUSES (defined below, in the
 * Settlements section) — delivered/cancelled/returned are exactly the
 * statuses that are "out of the pipeline" for both settlement eligibility
 * and stock purposes:
 *   - non-terminal → terminal (first time):  stock -= quantity
 *   - terminal → non-terminal (reverted):     stock += quantity
 *   - terminal → terminal (any combination):  no change (already "out")
 *   - non-terminal → non-terminal:            no change (never was "out")
 * Wrapped in a transaction so the status update and stock adjustment can
 * never desync on partial failure. If the linked product was since deleted,
 * the stock UPDATE simply matches 0 rows — no error, adjustment silently
 * skipped, order status still updates normally.
 */
export async function updatePhysicalOrderStatus(id: number, status: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.transaction(async (tx) => {
    const [order] = await tx.select({
      status: physicalOrders.status,
      productId: physicalOrders.productId,
      quantity: physicalOrders.quantity,
    }).from(physicalOrders).where(eq(physicalOrders.id, id)).limit(1);

    if (!order) throw new Error("الطلب غير موجود");

    const wasOut = (PHYSICAL_TERMINAL_STATUSES as readonly string[]).includes(order.status);
    const isOut = (PHYSICAL_TERMINAL_STATUSES as readonly string[]).includes(status);

    if (order.productId && wasOut !== isOut) {
      const delta = isOut ? -order.quantity : order.quantity;
      await tx.update(physicalProducts)
        .set({ stock: sql`${physicalProducts.stock} + ${delta}` })
        .where(eq(physicalProducts.id, order.productId));
    }

    await tx.update(physicalOrders).set({ status: status as any }).where(eq(physicalOrders.id, id));
  });
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
  // Absolute IQD amount, frozen via computeFrozenCommission from the
  // merchant's commissionType/commissionValue - the sole source for every
  // row created going forward. digitalLevelAtSaleTime is intentionally NOT
  // accepted here anymore (falls to its DB default) - see schema.ts comment.
  commissionAtSaleTime: number;
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

// ==================== Settlements ====================

// Terminal statuses that participate in a settlement sweep. Non-terminal
// physical statuses (new/preparing/shipped) are never touched — an order
// still in the pipeline can't be settled.
const PHYSICAL_TERMINAL_STATUSES = ["delivered", "cancelled", "returned"] as const;
const DIGITAL_TERMINAL_STATUSES = ["delivered", "cancelled"] as const;

/**
 * Computes a merchant's current unsettled balance. Single source of truth
 * for the physical-vs-digital branch, reused by getMerchantPerformance
 * (additive fields only), createSettlement (to snapshot the amount inside
 * the same transaction), and settlements.myBalance. Mirrors
 * getMerchantPerformance's existing per-type branching, scoped additionally
 * to settlementId IS NULL.
 *
 * deliveredRows are the specific delivered (money-contributing) rows, used
 * for the merchant-facing "orders that make up my current balance" list.
 */
export async function getUnsettledBalanceForMerchant(merchant: Merchant): Promise<{
  amount: number;
  deliveredCount: number;
  cancelledCount: number; // cancelled + returned combined
  deliveredRows: Array<{ id: number; productType: string; amount: number; createdAt: Date }>;
}> {
  const db = await getDb();
  if (!db) return { amount: 0, deliveredCount: 0, cancelledCount: 0, deliveredRows: [] };

  if (merchant.merchantType === "physical") {
    const rows = await db.select({
      id: physicalOrders.id,
      productType: physicalOrders.productType,
      status: physicalOrders.status,
      commissionAtOrderTime: physicalOrders.commissionAtOrderTime,
      createdAt: physicalOrders.createdAt,
    }).from(physicalOrders).where(and(
      eq(physicalOrders.merchantId, merchant.id),
      isNull(physicalOrders.settlementId),
      inArray(physicalOrders.status, PHYSICAL_TERMINAL_STATUSES),
    ));

    const delivered = rows.filter(r => r.status === "delivered");
    const cancelled = rows.filter(r => r.status !== "delivered");
    return {
      amount: delivered.reduce((acc, r) => acc + r.commissionAtOrderTime, 0),
      deliveredCount: delivered.length,
      cancelledCount: cancelled.length,
      deliveredRows: delivered.map(r => ({ id: r.id, productType: r.productType, amount: r.commissionAtOrderTime, createdAt: r.createdAt })),
    };
  }

  const rows = await db.select({
    id: digitalSales.id,
    productType: digitalSales.productType,
    status: digitalSales.status,
    productPrice: digitalSales.productPrice,
    digitalLevelAtSaleTime: digitalSales.digitalLevelAtSaleTime,
    commissionAtSaleTime: digitalSales.commissionAtSaleTime,
    createdAt: digitalSales.createdAt,
  }).from(digitalSales).where(and(
    eq(digitalSales.merchantId, merchant.id),
    isNull(digitalSales.settlementId),
    inArray(digitalSales.status, DIGITAL_TERMINAL_STATUSES),
  ));

  const delivered = rows.filter(r => r.status === "delivered");
  const cancelled = rows.filter(r => r.status !== "delivered");
  return {
    amount: delivered.reduce((acc, r) => acc + resolveDigitalCommission(r), 0),
    deliveredCount: delivered.length,
    cancelledCount: cancelled.length,
    deliveredRows: delivered.map(r => ({
      id: r.id,
      productType: r.productType,
      amount: resolveDigitalCommission(r),
      createdAt: r.createdAt,
    })),
  };
}

/**
 * Atomically settles a merchant's full current unsettled balance: inserts
 * one settlements row, then stamps that row's id onto every terminal-status,
 * currently-unsettled physicalOrders/digitalSales row for that merchant.
 * Wrapped in a transaction so a partial failure never leaves an orphaned
 * settlement row (with no linked orders) or vice versa. Always a full
 * settlement — no partial subset selection. Recomputes the balance inside
 * the transaction (not reusing a caller-supplied figure) so a race with a
 * newly-arrived order between page load and click can't create a stale
 * settlement amount.
 */
export async function createSettlement(merchant: Merchant, note?: string): Promise<Settlement> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.transaction(async (tx) => {
    if (merchant.merchantType === "physical") {
      const rows = await tx.select({
        id: physicalOrders.id,
        status: physicalOrders.status,
        commissionAtOrderTime: physicalOrders.commissionAtOrderTime,
      }).from(physicalOrders).where(and(
        eq(physicalOrders.merchantId, merchant.id),
        isNull(physicalOrders.settlementId),
        inArray(physicalOrders.status, PHYSICAL_TERMINAL_STATUSES),
      ));

      if (rows.length === 0) {
        throw new Error("لا يوجد رصيد قابل للتسوية لهذا التاجر");
      }

      const delivered = rows.filter(r => r.status === "delivered");
      const cancelled = rows.filter(r => r.status !== "delivered");
      const amount = delivered.reduce((acc, r) => acc + r.commissionAtOrderTime, 0);

      await tx.insert(settlements).values({
        merchantId: merchant.id,
        merchantName: merchant.name,
        merchantType: "physical",
        amount,
        deliveredCount: delivered.length,
        cancelledCount: cancelled.length,
        note: note || null,
      });
      const [created] = await tx.select().from(settlements)
        .where(eq(settlements.merchantId, merchant.id))
        .orderBy(desc(settlements.id)).limit(1);

      await tx.update(physicalOrders)
        .set({ settlementId: created.id })
        .where(inArray(physicalOrders.id, rows.map(r => r.id)));

      return created;
    }

    const rows = await tx.select({
      id: digitalSales.id,
      status: digitalSales.status,
      productPrice: digitalSales.productPrice,
      digitalLevelAtSaleTime: digitalSales.digitalLevelAtSaleTime,
      commissionAtSaleTime: digitalSales.commissionAtSaleTime,
    }).from(digitalSales).where(and(
      eq(digitalSales.merchantId, merchant.id),
      isNull(digitalSales.settlementId),
      inArray(digitalSales.status, DIGITAL_TERMINAL_STATUSES),
    ));

    if (rows.length === 0) {
      throw new Error("لا يوجد رصيد قابل للتسوية لهذا التاجر");
    }

    const delivered = rows.filter(r => r.status === "delivered");
    const cancelled = rows.filter(r => r.status !== "delivered");
    const amount = delivered.reduce((acc, r) => acc + resolveDigitalCommission(r), 0);

    await tx.insert(settlements).values({
      merchantId: merchant.id,
      merchantName: merchant.name,
      merchantType: "digital",
      amount,
      deliveredCount: delivered.length,
      cancelledCount: cancelled.length,
      note: note || null,
    });
    const [created] = await tx.select().from(settlements)
      .where(eq(settlements.merchantId, merchant.id))
      .orderBy(desc(settlements.id)).limit(1);

    await tx.update(digitalSales)
      .set({ settlementId: created.id })
      .where(inArray(digitalSales.id, rows.map(r => r.id)));

    return created;
  });
}

export async function getSettlementsByMerchant(merchantId: number): Promise<Settlement[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(settlements).where(eq(settlements.merchantId, merchantId)).orderBy(desc(settlements.createdAt));
}

export async function getFilteredSettlements(filters: {
  merchantId?: number;
  merchantType?: "physical" | "digital";
  startDate?: Date;
  endDate?: Date;
}): Promise<Settlement[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.merchantId) conditions.push(eq(settlements.merchantId, filters.merchantId));
  if (filters.merchantType) conditions.push(eq(settlements.merchantType, filters.merchantType));
  if (filters.startDate) conditions.push(gte(settlements.createdAt, filters.startDate));
  if (filters.endDate) conditions.push(lte(settlements.createdAt, filters.endDate));
  if (conditions.length === 0) {
    return await db.select().from(settlements).orderBy(desc(settlements.createdAt));
  }
  return await db.select().from(settlements).where(and(...conditions)).orderBy(desc(settlements.createdAt));
}

// ==================== Profit Settlements (hierarchy commission system) ====================
// sales_rep -> supervisor -> leader -> manager, via merchants.parentId.
// Any ancestor (any role) with a non-null overridePercentage draws an
// independent share of the common base (netProfit - merchantShare) - not a
// waterfall off each other's remainder. See calculateProfitShares below for
// the exact formula. Fully independent from physicalOrders.settlementId /
// the legacy `settlements` table (see physicalOrders.profitSettlementId).

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface AncestorShare {
  merchantId: number;
  role: Merchant["role"];
  overridePercentage: number; // frozen at settlement time
  shareAmount: number;
}

export interface ProfitShareBreakdown {
  netProfit: number;
  merchantShare: number;
  commonBase: number; // netProfit - merchantShare, floored at 0 - what ancestor shares are drawn from
  ancestorShares: AncestorShare[];
  companyShare: number;
}

// Pure calculation, no DB access - safe to unit test directly.
export function calculateProfitShares(input: {
  grossProfit: number;
  promotionCost: number;
  merchantShare: number; // pre-summed from each swept order's frozen commissionAtOrderTime
  ancestors: Array<{ merchantId: number; role: Merchant["role"]; overridePercentage: number }>;
}): ProfitShareBreakdown {
  // The company absorbs any loss from promotion cost exceeding gross profit -
  // netProfit is never negative, and the merchant never carries a loss.
  const netProfit = round2(Math.max(0, input.grossProfit - input.promotionCost));

  // merchantShare is already the sum of each order's own frozen
  // commissionAtOrderTime (see computeFrozenCommission) - never recomputed
  // from the merchant's current commissionType/commissionValue, same freeze
  // principle as every other *AtOrderTime field. Still capped at netProfit
  // (e.g. promotion cost ate most of the profit) so companyShare below can't
  // go negative from this term.
  const merchantShare = round2(Math.min(input.merchantShare, netProfit));

  // Every override-holding ancestor draws their percentage from this same
  // base independently - a supervisor's 30% and a manager's 10% both apply
  // to commonBase, never to "what's left after the supervisor already took
  // theirs".
  const commonBase = round2(Math.max(0, netProfit - merchantShare));

  const rawShares = input.ancestors.map(a => ({
    ...a,
    raw: commonBase * (a.overridePercentage / 100),
  }));
  const rawTotal = rawShares.reduce((sum, s) => sum + s.raw, 0);
  // If the ancestors' percentages independently sum to more than the common
  // base itself, scale every share down proportionally so their total never
  // exceeds commonBase - companyShare can never go negative from this.
  const scale = rawTotal > commonBase && rawTotal > 0 ? commonBase / rawTotal : 1;

  const ancestorShares: AncestorShare[] = rawShares.map(s => ({
    merchantId: s.merchantId,
    role: s.role,
    overridePercentage: s.overridePercentage,
    shareAmount: round2(s.raw * scale),
  }));

  const totalAncestorShares = ancestorShares.reduce((sum, s) => sum + s.shareAmount, 0);
  const companyShare = round2(Math.max(0, netProfit - merchantShare - totalAncestorShares));

  return { netProfit, merchantShare, commonBase, ancestorShares, companyShare };
}

// Walks merchants.parentId upward from (but not including) startMerchantId,
// collecting EVERY ancestor with a non-null overridePercentage - any role,
// not just "manager", and regardless of whether intermediate ancestors have
// one set. Cycle-guarded (parentId has no DB-level FK, so a bad edit could
// loop).
export async function findAllAncestorsWithOverride(startMerchantId: number): Promise<Merchant[]> {
  const visited = new Set<number>([startMerchantId]);
  const result: Merchant[] = [];
  let current = await getMerchantById(startMerchantId);

  while (current?.parentId != null) {
    if (visited.has(current.parentId)) break; // cycle
    visited.add(current.parentId);

    const parent = await getMerchantById(current.parentId);
    if (!parent) break;
    if (parent.overridePercentage != null) result.push(parent);

    current = parent;
  }

  return result;
}

// Orchestrates the two steps above for a given merchant's profit event.
export async function computeProfitShares(
  merchantId: number,
  grossProfit: number,
  promotionCost: number,
  merchantShare: number, // pre-summed by the caller from commissionAtOrderTime across swept orders
): Promise<ProfitShareBreakdown> {
  const merchant = await getMerchantById(merchantId);
  if (!merchant) throw new Error("التاجر غير موجود");

  const ancestors = await findAllAncestorsWithOverride(merchantId);

  return calculateProfitShares({
    grossProfit,
    promotionCost,
    merchantShare,
    ancestors: ancestors.map(a => ({
      merchantId: a.id,
      role: a.role,
      overridePercentage: a.overridePercentage as number, // filtered non-null above
    })),
  });
}

// Every currently-eligible order for a hierarchical profit settlement: this
// merchant's "delivered" physical orders, not yet swept into a profit
// settlement (profitSettlementId IS NULL), within the given period. Same
// delivered-only revenue-recognition rule as the legacy settlements flow
// (see PHYSICAL_TERMINAL_STATUSES / getUnsettledBalanceForMerchant above),
// but scoped to profitSettlementId rather than settlementId.
export async function getEligibleProfitOrders(
  merchantId: number,
  periodStart: Date,
  periodEnd: Date,
): Promise<Array<{
  id: number;
  productType: string;
  productPrice: number;
  quantity: number;
  totalPrice: number;
  wholesaleCostAtOrderTime: number;
  deliveryCostAtOrderTime: number;
  grossProfitAtOrderTime: number;
  commissionAtOrderTime: number;
  createdAt: Date;
}>> {
  const db = await getDb();
  if (!db) return [];
  return await db.select({
    id: physicalOrders.id,
    productType: physicalOrders.productType,
    productPrice: physicalOrders.productPrice,
    quantity: physicalOrders.quantity,
    totalPrice: physicalOrders.totalPrice,
    wholesaleCostAtOrderTime: physicalOrders.wholesaleCostAtOrderTime,
    deliveryCostAtOrderTime: physicalOrders.deliveryCostAtOrderTime,
    grossProfitAtOrderTime: physicalOrders.grossProfitAtOrderTime,
    commissionAtOrderTime: physicalOrders.commissionAtOrderTime,
    createdAt: physicalOrders.createdAt,
  }).from(physicalOrders).where(and(
    eq(physicalOrders.merchantId, merchantId),
    eq(physicalOrders.status, "delivered"),
    isNull(physicalOrders.profitSettlementId),
    gte(physicalOrders.createdAt, periodStart),
    lte(physicalOrders.createdAt, periodEnd),
  )).orderBy(desc(physicalOrders.createdAt));
}

// Merchants with at least one delivered, not-yet-profit-settled physical
// order - populates the merchant picker on the hierarchical settlements
// admin page. Two-step (distinct merchantIds, then fetch rows) rather than a
// join, consistent with the rest of this file's query style.
export async function getMerchantsWithUnsettledProfitOrders(): Promise<Merchant[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.selectDistinct({ merchantId: physicalOrders.merchantId })
    .from(physicalOrders)
    .where(and(
      eq(physicalOrders.status, "delivered"),
      isNull(physicalOrders.profitSettlementId),
    ));
  if (rows.length === 0) return [];
  return await db.select().from(merchants).where(inArray(merchants.id, rows.map(r => r.merchantId)));
}

// Dry-run of createProfitSettlement's calculation below - same grossProfit
// derivation, no DB writes. Powers the admin page's "معاينة" button.
export async function previewProfitSettlement(
  merchantId: number,
  periodStart: Date,
  periodEnd: Date,
  promotionCost: number,
): Promise<ProfitShareBreakdown & { grossProfit: number; orderCount: number }> {
  const orders = await getEligibleProfitOrders(merchantId, periodStart, periodEnd);
  const grossProfit = orders.reduce((acc, o) => acc + o.grossProfitAtOrderTime, 0);
  const merchantShare = orders.reduce((acc, o) => acc + o.commissionAtOrderTime, 0);
  const shares = await computeProfitShares(merchantId, grossProfit, promotionCost, merchantShare);
  return { ...shares, grossProfit, orderCount: orders.length };
}

// Computes shares and persists the settlement + one profitSettlementShares
// row per ancestor, atomically alongside stamping profitSettlementId onto
// every terminal-status (delivered/cancelled/returned), currently-unsettled
// physicalOrders row for this merchant within the period - mirrors
// createSettlement's transaction pattern above (recomputes everything inside
// the transaction rather than trusting a caller-supplied grossProfit, so a
// race with a newly-arrived order between preview and confirm can't produce
// a stale amount). Always created as "draft" (see profitSettlements.status),
// never "confirmed" directly. grossProfit is no longer a caller input - it's
// derived entirely from delivered orders' frozen grossProfitAtOrderTime.
export async function createProfitSettlement(input: {
  merchantId: number;
  productId?: number;
  periodStart: Date;
  periodEnd: Date;
  promotionCost: number;
  promotionProofUrl?: string;
}): Promise<ProfitSettlement> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.transaction(async (tx) => {
    const rows = await tx.select({
      id: physicalOrders.id,
      status: physicalOrders.status,
      grossProfitAtOrderTime: physicalOrders.grossProfitAtOrderTime,
      commissionAtOrderTime: physicalOrders.commissionAtOrderTime,
    }).from(physicalOrders).where(and(
      eq(physicalOrders.merchantId, input.merchantId),
      isNull(physicalOrders.profitSettlementId),
      inArray(physicalOrders.status, PHYSICAL_TERMINAL_STATUSES),
      gte(physicalOrders.createdAt, input.periodStart),
      lte(physicalOrders.createdAt, input.periodEnd),
    ));

    const delivered = rows.filter(r => r.status === "delivered");
    if (delivered.length === 0) {
      throw new Error("لا يوجد ربح قابل للتسوية بهذه الفترة");
    }

    const grossProfit = delivered.reduce((acc, r) => acc + r.grossProfitAtOrderTime, 0);
    const merchantShare = delivered.reduce((acc, r) => acc + r.commissionAtOrderTime, 0);
    const shares = await computeProfitShares(input.merchantId, grossProfit, input.promotionCost, merchantShare);

    await tx.insert(profitSettlements).values({
      merchantId: input.merchantId,
      productId: input.productId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      grossProfit: grossProfit.toFixed(2),
      promotionCost: input.promotionCost.toFixed(2),
      promotionProofUrl: input.promotionProofUrl,
      netProfit: shares.netProfit.toFixed(2),
      merchantShare: shares.merchantShare.toFixed(2),
      companyShare: shares.companyShare.toFixed(2),
    });

    const [created] = await tx.select().from(profitSettlements)
      .where(eq(profitSettlements.merchantId, input.merchantId))
      .orderBy(desc(profitSettlements.id)).limit(1);

    if (shares.ancestorShares.length > 0) {
      await tx.insert(profitSettlementShares).values(
        shares.ancestorShares.map(a => ({
          settlementId: created.id,
          merchantId: a.merchantId,
          role: a.role,
          overridePercentage: a.overridePercentage,
          shareAmount: a.shareAmount.toFixed(2),
        }))
      );
    }

    await tx.update(physicalOrders)
      .set({ profitSettlementId: created.id })
      .where(inArray(physicalOrders.id, rows.map(r => r.id)));

    return created;
  });
}

export async function getFilteredProfitSettlements(filters: {
  merchantId?: number;
  status?: "draft" | "confirmed";
}): Promise<ProfitSettlement[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.merchantId) conditions.push(eq(profitSettlements.merchantId, filters.merchantId));
  if (filters.status) conditions.push(eq(profitSettlements.status, filters.status));
  if (conditions.length === 0) {
    return await db.select().from(profitSettlements).orderBy(desc(profitSettlements.createdAt));
  }
  return await db.select().from(profitSettlements).where(and(...conditions)).orderBy(desc(profitSettlements.createdAt));
}

export async function confirmProfitSettlement(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(profitSettlements).set({ status: "confirmed" }).where(eq(profitSettlements.id, id));
}

export async function getProfitSettlementsByMerchant(merchantId: number): Promise<ProfitSettlement[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(profitSettlements)
    .where(eq(profitSettlements.merchantId, merchantId))
    .orderBy(desc(profitSettlements.createdAt));
}

export type MaskedProfitSettlement = Omit<ProfitSettlement, "grossProfit" | "promotionCost"> & {
  grossProfit: string | null;
  promotionCost: string | null;
};

// grossProfit/promotionCost are admin-entered and only meaningful to the
// sales_rep who generated them - everyone above (supervisor/leader/manager)
// only ever sees the computed shares, never the raw inputs.
export function maskProfitSettlementForRole(
  row: ProfitSettlement,
  viewerRole: Merchant["role"],
): MaskedProfitSettlement {
  if (viewerRole === "sales_rep") return row;
  return { ...row, grossProfit: null, promotionCost: null };
}

// Direct children only (one level down): supervisor -> their sales_reps,
// leader -> their supervisors. Not recursive - see getAllDescendantMerchantIds
// for the manager's full-tree view.
export async function getDirectSubordinates(merchantId: number): Promise<Merchant[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(merchants).where(eq(merchants.parentId, merchantId));
}

export async function getDirectSubordinatesWithSettlements(merchantId: number): Promise<Array<{
  merchant: Merchant;
  settlements: ProfitSettlement[];
}>> {
  const subs = await getDirectSubordinates(merchantId);
  const result = [];
  for (const sub of subs) {
    result.push({ merchant: sub, settlements: await getProfitSettlementsByMerchant(sub.id) });
  }
  return result;
}

// Recursive walk down parentId from merchantId (exclusive) - the manager's
// entire org tree, for subordinatesSummary. No DB-level FK on parentId (see
// findNearestManagerAncestor above), so this is app-level tree traversal
// rather than a recursive SQL CTE.
export async function getAllDescendantMerchantIds(merchantId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const all = await db.select({ id: merchants.id, parentId: merchants.parentId }).from(merchants);
  const childrenByParent = new Map<number, number[]>();
  for (const m of all) {
    if (m.parentId == null) continue;
    const siblings = childrenByParent.get(m.parentId) ?? [];
    siblings.push(m.id);
    childrenByParent.set(m.parentId, siblings);
  }

  const result: number[] = [];
  const queue = [...(childrenByParent.get(merchantId) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(id);
    queue.push(...(childrenByParent.get(id) ?? []));
  }
  return result;
}

export interface SubordinatesSummary {
  subordinateCount: number;
  settlementCount: number;
  totalNetProfit: number;
  totalManagerOverrideShare: number;
  totalCompanyShare: number;
}

// Manager-only rollup across their entire subordinate tree (sales_reps,
// supervisors, leaders below them) - aggregated shares only, grossProfit/
// promotionCost never included (same masking rule as mySettlements).
export async function getSubordinatesSummary(managerId: number): Promise<SubordinatesSummary> {
  const db = await getDb();
  const descendantIds = await getAllDescendantMerchantIds(managerId);
  if (!db || descendantIds.length === 0) {
    return { subordinateCount: descendantIds.length, settlementCount: 0, totalNetProfit: 0, totalManagerOverrideShare: 0, totalCompanyShare: 0 };
  }

  const rows = await db.select().from(profitSettlements).where(inArray(profitSettlements.merchantId, descendantIds));

  let totalNetProfit = 0;
  let totalCompanyShare = 0;
  for (const row of rows) {
    totalNetProfit = round2(totalNetProfit + parseFloat(row.netProfit));
    totalCompanyShare = round2(totalCompanyShare + parseFloat(row.companyShare));
  }

  // Sourced from profitSettlementShares (this manager's own share rows,
  // regardless of which descendant's settlement generated them) rather than
  // the legacy profitSettlements.managerOverrideShare column, which
  // createProfitSettlement no longer writes to.
  const shareRows = await db.select({ shareAmount: profitSettlementShares.shareAmount })
    .from(profitSettlementShares)
    .where(eq(profitSettlementShares.merchantId, managerId));
  const totalManagerOverrideShare = shareRows.reduce((acc, r) => round2(acc + parseFloat(r.shareAmount)), 0);

  return {
    subordinateCount: descendantIds.length,
    settlementCount: rows.length,
    totalNetProfit,
    totalManagerOverrideShare,
    totalCompanyShare,
  };
}

// ==================== Dashboard Stats ====================

// Legacy digital commission percentage lookup - only used as a fallback for
// rows created before commissionAtSaleTime existed (see resolveDigitalCommission
// below). Never called with the merchant's *current* digitalLevel.
export function digitalLevelToPercent(level: "1" | "2" | "3"): number {
  return level === "3" ? 0.5 : level === "2" ? 0.4 : 0.3;
}

// Single source of truth for resolving a merchant's commission into an
// absolute IQD amount at the moment an order/sale is created — both
// physicalOrders.commissionAtOrderTime and digitalSales.commissionAtSaleTime
// are frozen via this same function, replacing the old
// merchant.commission/digitalLevel-based freezing.
export function computeFrozenCommission(
  commissionType: "fixed" | "percentage",
  commissionValue: number,
  baseAmount: number,
): number {
  return commissionType === "fixed" ? commissionValue : Math.floor(baseAmount * (commissionValue / 100));
}

// Freezes a physical order's cost/profit snapshot from its linked catalog
// product at the moment of creation - same freeze-on-insert principle as
// computeFrozenCommission above. wholesaleCost is a per-unit cost (scaled by
// quantity); deliveryCost is a flat per-order cost (one shipment covers the
// whole quantity, never multiplied). grossProfit does not deduct the
// merchant's own commissionAtOrderTime. `product` is undefined for the
// manual "إدخال يدوي" order path (no productId) or when the linked product
// was since deleted - both treated as zero cost.
export function computeFrozenProductCosts(
  product: Pick<PhysicalProduct, "wholesaleCost" | "deliveryCost"> | undefined,
  quantity: number,
  totalPrice: number,
): { wholesaleCostAtOrderTime: number; deliveryCostAtOrderTime: number; grossProfitAtOrderTime: number } {
  const wholesaleCostAtOrderTime = (product?.wholesaleCost ?? 0) * quantity;
  const deliveryCostAtOrderTime = product?.deliveryCost ?? 0;
  const grossProfitAtOrderTime = totalPrice - wholesaleCostAtOrderTime - deliveryCostAtOrderTime;
  return { wholesaleCostAtOrderTime, deliveryCostAtOrderTime, grossProfitAtOrderTime };
}

// digitalSales rows created before commissionAtSaleTime existed have it NULL
// - fall back to the old digitalLevelAtSaleTime+digitalLevelToPercent path for
// those (frozen at their own time, never recomputed). New rows always have
// commissionAtSaleTime populated and use it directly.
export function resolveDigitalCommission(sale: {
  productPrice: number;
  commissionAtSaleTime: number | null;
  digitalLevelAtSaleTime: "1" | "2" | "3";
}): number {
  return sale.commissionAtSaleTime ?? Math.floor(sale.productPrice * digitalLevelToPercent(sale.digitalLevelAtSaleTime));
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
    commissionAtSaleTime: digitalSales.commissionAtSaleTime,
  }).from(digitalSales).where(eq(digitalSales.status, "delivered"));

  const digiEarnings = deliveredDigitalSales.reduce(
    (acc, sale) => acc + resolveDigitalCommission(sale),
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

// Lightweight, merchant-safe stats — counts only, no revenue/commission data.
export async function getTrustStats() {
  const db = await getDb();
  if (!db) return { totalMerchants: 0, totalCompletedOrders: 0 };

  const [merchCount] = await db.select({ value: count() }).from(merchants);

  const [physDelivered] = await db.select({ value: count() })
    .from(physicalOrders).where(eq(physicalOrders.status, "delivered"));

  const [digiDelivered] = await db.select({ value: count() })
    .from(digitalSales).where(eq(digitalSales.status, "delivered"));

  return {
    totalMerchants: merchCount?.value ?? 0,
    totalCompletedOrders: (physDelivered?.value ?? 0) + (digiDelivered?.value ?? 0),
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
    // Same freeze for digital sales: each row's own commissionAtSaleTime (or
    // digitalLevelAtSaleTime for legacy rows), never the merchant's current
    // commissionValue/digitalLevel.
    const deliveredDigitalSales = await db.select({
      productPrice: digitalSales.productPrice,
      digitalLevelAtSaleTime: digitalSales.digitalLevelAtSaleTime,
      commissionAtSaleTime: digitalSales.commissionAtSaleTime,
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
      // Digital: each delivered sale's own frozen commission
      merchantEarnings = deliveredDigitalSales.reduce(
        (acc, sale) => acc + resolveDigitalCommission(sale),
        0,
      );
      adminProfit = digiRevNum - merchantEarnings;
    }

    // Additive fields only — merchantEarnings/adminProfit above remain
    // lifetime totals (unchanged). currentBalance is the still-unpaid subset
    // (see getUnsettledBalanceForMerchant), used by the admin UI to decide
    // whether the "تسوية الأرباح" button should show for this merchant.
    const unsettled = await getUnsettledBalanceForMerchant(merchant);

    result.push({
      id: merchant.id,
      name: merchant.name,
      username: merchant.username,
      merchantType: merchant.merchantType,
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
      currentBalance: unsettled.amount,
      currentBalanceDeliveredCount: unsettled.deliveredCount,
      currentBalanceCancelledCount: unsettled.cancelledCount,
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

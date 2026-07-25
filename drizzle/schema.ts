import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing Manus OAuth flow (admin/owner).
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Merchants table - each merchant logs in with username + password.
 * The owner (IBRAHIM WALEED) is an admin user via the `users` table (Manus OAuth).
 * Merchants are separate from the Manus auth system.
 * Admin creates all merchant accounts (no open signup).
 * merchantType: 'physical' = تجارة مادية (fixed commission per order), 'digital' = تجارة رقمية (percentage commission).
 * commission: fixed IQD amount per order for physical merchants.
 * digitalLevel: commission percentage level for digital merchants (1=30%, 2=40%, 3=50%).
 * failedAttempts + lockedUntil: brute-force protection (lock after 5 failed attempts).
 */
export const merchants = mysqlTable("merchants", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  passcode: varchar("passcode", { length: 255 }).notNull(),
  merchantType: mysqlEnum("merchantType", ["physical", "digital"]).default("physical").notNull(),
  commission: int("commission").default(0).notNull(), // fixed IQD per order for physical merchants
  digitalLevel: mysqlEnum("digitalLevel", ["1", "2", "3"]).default("1").notNull(), // commission level for digital merchants
  failedAttempts: int("failedAttempts").default(0).notNull(),
  lockedUntil: timestamp("lockedUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn"),
});

export type Merchant = typeof merchants.$inferSelect;
export type InsertMerchant = typeof merchants.$inferInsert;

/**
 * Admins table - internal admin login, separate from Manus OAuth (`users`) and from merchants.
 * Same passcode storage + brute-force lock pattern as merchants (failedAttempts/lockedUntil).
 */
export const admins = mysqlTable("admins", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  passcode: varchar("passcode", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  failedAttempts: int("failedAttempts").default(0).notNull(),
  lockedUntil: timestamp("lockedUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = typeof admins.$inferInsert;

/**
 * Physical products - managed by admin.
 */
export const physicalProducts = mysqlTable("physical_products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  price: int("price").notNull(), // stored in smallest currency unit (e.g. IQD)
  type: varchar("type", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PhysicalProduct = typeof physicalProducts.$inferSelect;
export type InsertPhysicalProduct = typeof physicalProducts.$inferInsert;

/**
 * Digital products - managed by admin.
 */
export const digitalProducts = mysqlTable("digital_products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  price: int("price").notNull(),
  type: varchar("type", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DigitalProduct = typeof digitalProducts.$inferSelect;
export type InsertDigitalProduct = typeof digitalProducts.$inferInsert;

/**
 * Physical orders - created by merchants.
 */
export const physicalOrders = mysqlTable("physical_orders", {
  id: int("id").autoincrement().primaryKey(),
  merchantId: int("merchantId").notNull(),
  merchantName: varchar("merchantName", { length: 255 }).notNull(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 20 }).notNull(),
  productType: varchar("productType", { length: 255 }).notNull(),
  productPrice: int("productPrice").notNull(),
  quantity: int("quantity").notNull().default(1),
  totalPrice: int("totalPrice").notNull(),
  province: varchar("province", { length: 255 }).notNull(),
  district: varchar("district", { length: 255 }).notNull(),
  notes: text("notes"),
  status: mysqlEnum("status", ["new", "preparing", "shipped", "delivered", "cancelled", "returned"]).default("new").notNull(),
  // Merchant's fixed IQD commission at the moment this order was created. Frozen
  // on insert so a later commission change never retroactively changes past
  // orders' payouts/reports. Existing rows default to 0 pending a one-time
  // backfill (server/scripts/backfillCommissionSnapshots.ts) — approximate for
  // historical data only.
  commissionAtOrderTime: int("commissionAtOrderTime").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PhysicalOrder = typeof physicalOrders.$inferSelect;
export type InsertPhysicalOrder = typeof physicalOrders.$inferInsert;

/**
 * Digital sales - created by merchants, auto-delivered.
 */
export const digitalSales = mysqlTable("digital_sales", {
  id: int("id").autoincrement().primaryKey(),
  merchantId: int("merchantId").notNull(),
  merchantName: varchar("merchantName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 20 }).notNull(),
  productType: varchar("productType", { length: 255 }).notNull(),
  productPrice: int("productPrice").notNull(),
  proofImageKey: text("proofImageKey"), // S3 key for the proof image
  proofImageUrl: text("proofImageUrl"), // /manus-storage/ path
  status: mysqlEnum("status", ["delivered", "cancelled"]).default("delivered").notNull(),
  // Merchant's commission level at the moment this sale was created. Frozen on
  // insert (same reasoning as physicalOrders.commissionAtOrderTime) — the
  // percentage itself (0.3/0.4/0.5) is derived from this level, not stored
  // separately, so there is a single source of truth. Existing rows default to
  // "1" pending a one-time backfill — approximate for historical data only.
  digitalLevelAtSaleTime: mysqlEnum("digitalLevelAtSaleTime", ["1", "2", "3"]).default("1").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DigitalSale = typeof digitalSales.$inferSelect;
export type InsertDigitalSale = typeof digitalSales.$inferInsert;

import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock db module with updated function names
vi.mock("./db", () => ({
  getMerchantByUsername: vi.fn(),
  getMerchantById: vi.fn(),
  createMerchantByAdmin: vi.fn(),
  updateMerchantLastSignIn: vi.fn(),
  getAllMerchants: vi.fn(),
  getMerchantPerformance: vi.fn(),
  deleteMerchant: vi.fn(),
  updateMerchantPasscode: vi.fn(),
  updateMerchantLevel: vi.fn(),
  incrementFailedAttempts: vi.fn(),
  resetFailedAttempts: vi.fn(),
  getAdminByUsername: vi.fn(),
  getAdminById: vi.fn(),
  incrementAdminFailedAttempts: vi.fn(),
  resetAdminFailedAttempts: vi.fn(),
  createPhysicalOrder: vi.fn(),
  getPhysicalOrdersByMerchant: vi.fn(),
  getAllPhysicalOrders: vi.fn(),
  updatePhysicalOrderStatus: vi.fn(),
  getFilteredPhysicalOrders: vi.fn(),
  createDigitalSale: vi.fn(),
  getDigitalSalesByMerchant: vi.fn(),
  getAllDigitalSales: vi.fn(),
  getFilteredDigitalSales: vi.fn(),
  getAllPhysicalProducts: vi.fn(),
  createPhysicalProduct: vi.fn(),
  updatePhysicalProduct: vi.fn(),
  deletePhysicalProduct: vi.fn(),
  getAllDigitalProducts: vi.fn(),
  createDigitalProduct: vi.fn(),
  updateDigitalProduct: vi.fn(),
  deleteDigitalProduct: vi.fn(),
  getDashboardStats: vi.fn(),
  getDailySalesStats: vi.fn(),
  getUnsettledBalanceForMerchant: vi.fn(),
  createSettlement: vi.fn(),
  getSettlementsByMerchant: vi.fn(),
  getFilteredSettlements: vi.fn(),
}));

// Mock notification
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(undefined),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ key: "test-key", url: "https://test.url" }),
}));

// Mock sdk
vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn().mockResolvedValue("mock-token"),
    verifySession: vi.fn().mockResolvedValue(null),
  },
}));

import * as db from "./db";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    admin: null,
    merchant: null,
    req: { protocol: "https", headers: {} } as any,
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as any,
  };
}

// App admin (internal `admins` table), gates every `appAdminProcedure` route.
function createAdminContext(): TrpcContext {
  return {
    user: null,
    admin: {
      id: 1,
      username: "admin",
      passcode: "admin1234",
      name: "IBRAHIM WALEED",
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    merchant: null,
    req: { protocol: "https", headers: {} } as any,
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as any,
  };
}

// Logged-in merchant session, gates every `merchantProcedure` route.
function createMerchantContext(
  merchantId = 1,
  overrides: Partial<{ commission: number; digitalLevel: "1" | "2" | "3"; merchantType: "physical" | "digital" }> = {}
): TrpcContext {
  return {
    user: null,
    admin: null,
    merchant: {
      id: merchantId,
      name: "Test Merchant",
      username: "testuser",
      passcode: "1234",
      merchantType: overrides.merchantType ?? "physical",
      commission: overrides.commission ?? 1000,
      digitalLevel: overrides.digitalLevel ?? "1",
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as any,
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as any,
  };
}

describe("Merchant Auth (username-based)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should login with correct username and passcode", async () => {
    vi.mocked(db.getMerchantByUsername).mockResolvedValue({
      id: 1, name: "Test Merchant", username: "testuser", passcode: "1234",
      merchantType: "physical", commission: 1000, digitalLevel: "1",
      failedAttempts: 0, lockedUntil: null,
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    } as any);
    vi.mocked(db.updateMerchantLastSignIn).mockResolvedValue(undefined as any);
    vi.mocked(db.resetFailedAttempts).mockResolvedValue(undefined as any);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.merchant.login({
      username: "testuser",
      passcode: "1234",
    });

    expect(result.id).toBe(1);
    expect(result.name).toBe("Test Merchant");
  });

  it("should reject login with wrong passcode", async () => {
    vi.mocked(db.getMerchantByUsername).mockResolvedValue({
      id: 1, name: "Test", username: "testuser", passcode: "1234",
      merchantType: "physical", commission: 1000, digitalLevel: "1",
      failedAttempts: 0, lockedUntil: null,
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    } as any);
    vi.mocked(db.incrementFailedAttempts).mockResolvedValue(undefined as any);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.merchant.login({ username: "testuser", passcode: "wrong" })
    ).rejects.toThrow();
  });

  it("should reject login with unregistered username", async () => {
    vi.mocked(db.getMerchantByUsername).mockResolvedValue(undefined as any);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.merchant.login({ username: "nonexistent", passcode: "1234" })
    ).rejects.toThrow();
  });
});

describe("Admin Auth (internal admins table)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should login with correct username and passcode", async () => {
    vi.mocked(db.getAdminByUsername).mockResolvedValue({
      id: 1, username: "admin", passcode: "admin1234", name: "IBRAHIM WALEED",
      failedAttempts: 0, lockedUntil: null,
      createdAt: new Date(), updatedAt: new Date(),
    } as any);
    vi.mocked(db.resetAdminFailedAttempts).mockResolvedValue(undefined as any);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.login({
      username: "admin",
      passcode: "admin1234",
    });

    expect(result.id).toBe(1);
    expect(result.name).toBe("IBRAHIM WALEED");
  });

  it("should reject login with wrong passcode", async () => {
    vi.mocked(db.getAdminByUsername).mockResolvedValue({
      id: 1, username: "admin", passcode: "admin1234", name: "IBRAHIM WALEED",
      failedAttempts: 0, lockedUntil: null,
      createdAt: new Date(), updatedAt: new Date(),
    } as any);
    vi.mocked(db.incrementAdminFailedAttempts).mockResolvedValue(1 as any);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.login({ username: "admin", passcode: "wrong" })
    ).rejects.toThrow();
  });

  it("should reject login with unregistered username", async () => {
    vi.mocked(db.getAdminByUsername).mockResolvedValue(undefined as any);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.login({ username: "nonexistent", passcode: "admin1234" })
    ).rejects.toThrow();
  });

  it("admin.me should return null with no session", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.me();
    expect(result).toBeNull();
  });

  it("admin.me should return the admin from context when logged in", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.me();
    expect(result).toEqual({ id: 1, name: "IBRAHIM WALEED", username: "admin" });
  });

  it("should reject appAdminProcedure routes for anonymous callers (IDOR-style admin gate)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.dashboard.stats()).rejects.toThrow();
  });
});

describe("Physical Orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a physical order using the logged-in merchant's id from the session", async () => {
    vi.mocked(db.createPhysicalOrder).mockResolvedValue({
      id: 1, merchantId: 7, merchantName: "Test",
      customerName: "Customer", customerPhone: "07700000000",
      productType: "Phone", productPrice: 50000, quantity: 2, totalPrice: 100000,
      province: "بغداد", district: "الكرادة", status: "new",
      createdAt: new Date(), updatedAt: new Date(),
    } as any);

    const ctx = createMerchantContext(7);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.physicalOrders.create({
      merchantName: "Test",
      customerName: "Customer",
      customerPhone: "07700000000",
      productType: "Phone",
      productPrice: 50000,
      quantity: 2,
      province: "بغداد",
      district: "الكرادة",
    });

    expect(result.id).toBe(1);
    expect(db.createPhysicalOrder).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId: 7, totalPrice: 100000 })
    );
  });

  it("should freeze the merchant's CURRENT commission into commissionAtOrderTime on create (commission freeze)", async () => {
    vi.mocked(db.createPhysicalOrder).mockResolvedValue({ id: 1 } as any);

    // Merchant's commission is 1000 at the moment this order is created.
    const ctx = createMerchantContext(7, { commission: 1000 });
    const caller = appRouter.createCaller(ctx);
    await caller.physicalOrders.create({
      merchantName: "Test",
      customerName: "Customer",
      customerPhone: "07700000000",
      productType: "Phone",
      productPrice: 50000,
      quantity: 1,
      province: "بغداد",
      district: "الكرادة",
    });

    expect(db.createPhysicalOrder).toHaveBeenCalledWith(
      expect.objectContaining({ commissionAtOrderTime: 1000 })
    );

    // Now the merchant is upgraded to 2000. A brand new order must freeze the
    // NEW value — it must never touch the earlier order's already-stored 1000.
    vi.clearAllMocks();
    vi.mocked(db.createPhysicalOrder).mockResolvedValue({ id: 2 } as any);
    const upgradedCtx = createMerchantContext(7, { commission: 2000 });
    const upgradedCaller = appRouter.createCaller(upgradedCtx);
    await upgradedCaller.physicalOrders.create({
      merchantName: "Test",
      customerName: "Customer",
      customerPhone: "07700000001",
      productType: "Phone",
      productPrice: 50000,
      quantity: 1,
      province: "بغداد",
      district: "الكرادة",
    });

    expect(db.createPhysicalOrder).toHaveBeenCalledWith(
      expect.objectContaining({ commissionAtOrderTime: 2000 })
    );
  });

  it("should reject physicalOrders.create for an anonymous caller (no merchant session)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.physicalOrders.create({
        merchantName: "Test",
        customerName: "Customer",
        customerPhone: "07700000000",
        productType: "Phone",
        productPrice: 50000,
        quantity: 2,
        province: "بغداد",
        district: "الكرادة",
      } as any)
    ).rejects.toThrow();
  });

  it("should scope physicalOrders.myOrders to the session's own merchant id, never a client-supplied one (IDOR fix)", async () => {
    vi.mocked(db.getPhysicalOrdersByMerchant).mockResolvedValue([]);

    // merchantId is no longer part of the input at all, so there is no way for a
    // logged-in merchant (id=7) to request another merchant's (id=99) orders.
    const ctx = createMerchantContext(7);
    const caller = appRouter.createCaller(ctx);
    await caller.physicalOrders.myOrders();

    expect(db.getPhysicalOrdersByMerchant).toHaveBeenCalledWith(7);
    expect(db.getPhysicalOrdersByMerchant).not.toHaveBeenCalledWith(99);
  });

  it("should reject physicalOrders.myOrders for an anonymous caller (no merchant session)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.physicalOrders.myOrders()).rejects.toThrow();
  });

  it("should list all physical orders as admin", async () => {
    vi.mocked(db.getAllPhysicalOrders).mockResolvedValue([]);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.physicalOrders.list();

    expect(result).toEqual([]);
  });

  it("should update order status as admin", async () => {
    vi.mocked(db.updatePhysicalOrderStatus).mockResolvedValue(undefined as any);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.physicalOrders.updateStatus({ id: 1, status: "shipped" });

    expect(result.success).toBe(true);
  });
});

describe("Digital Sales", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a digital sale using the logged-in merchant's id from the session", async () => {
    vi.mocked(db.createDigitalSale).mockResolvedValue({
      id: 1, merchantId: 7, merchantName: "Test",
      customerPhone: "0770", productType: "Course", productPrice: 25000,
      status: "delivered", proofImageKey: null, proofImageUrl: null,
      createdAt: new Date(), updatedAt: new Date(),
    } as any);

    const ctx = createMerchantContext(7);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.digitalSales.create({
      merchantName: "Test",
      customerPhone: "07700000000",
      productType: "Course",
      productPrice: 25000,
      proofImageBase64: "data:image/png;base64,AAAA",
      proofImageName: "proof.png",
    });

    expect(result.id).toBe(1);
    expect(db.createDigitalSale).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId: 7, productPrice: 25000 })
    );
  });

  it("should freeze the merchant's CURRENT digitalLevel into digitalLevelAtSaleTime on create (commission freeze)", async () => {
    vi.mocked(db.createDigitalSale).mockResolvedValue({ id: 1 } as any);

    // Merchant is at level "1" (30%) at the moment this sale is created.
    const ctx = createMerchantContext(7, { merchantType: "digital", digitalLevel: "1" });
    const caller = appRouter.createCaller(ctx);
    await caller.digitalSales.create({
      merchantName: "Test",
      customerPhone: "07700000000",
      productType: "Course",
      productPrice: 25000,
      proofImageBase64: "data:image/png;base64,AAAA",
      proofImageName: "proof.png",
    });

    expect(db.createDigitalSale).toHaveBeenCalledWith(
      expect.objectContaining({ digitalLevelAtSaleTime: "1" })
    );

    // Merchant is upgraded to level "2" (40%). A new sale must freeze the NEW
    // level — it must never touch the earlier sale's already-stored "1".
    vi.clearAllMocks();
    vi.mocked(db.createDigitalSale).mockResolvedValue({ id: 2 } as any);
    const upgradedCtx = createMerchantContext(7, { merchantType: "digital", digitalLevel: "2" });
    const upgradedCaller = appRouter.createCaller(upgradedCtx);
    await upgradedCaller.digitalSales.create({
      merchantName: "Test",
      customerPhone: "07700000001",
      productType: "Course",
      productPrice: 25000,
      proofImageBase64: "data:image/png;base64,AAAA",
      proofImageName: "proof.png",
    });

    expect(db.createDigitalSale).toHaveBeenCalledWith(
      expect.objectContaining({ digitalLevelAtSaleTime: "2" })
    );
  });

  it("should reject digitalSales.create for an anonymous caller (no merchant session)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.digitalSales.create({
        merchantName: "Test",
        customerPhone: "07700000000",
        productType: "Course",
        productPrice: 25000,
      } as any)
    ).rejects.toThrow();
  });

  it("should scope digitalSales.mySales to the session's own merchant id, never a client-supplied one (IDOR fix)", async () => {
    vi.mocked(db.getDigitalSalesByMerchant).mockResolvedValue([]);

    const ctx = createMerchantContext(7);
    const caller = appRouter.createCaller(ctx);
    await caller.digitalSales.mySales();

    expect(db.getDigitalSalesByMerchant).toHaveBeenCalledWith(7);
    expect(db.getDigitalSalesByMerchant).not.toHaveBeenCalledWith(99);
  });

  it("should reject digitalSales.mySales for an anonymous caller (no merchant session)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.digitalSales.mySales()).rejects.toThrow();
  });
});

describe("Products Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a physical product as admin", async () => {
    vi.mocked(db.createPhysicalProduct).mockResolvedValue({
      id: 1, name: "Test Product", price: 10000, type: "إلكتروني", description: "Test",
      createdAt: new Date(), updatedAt: new Date(),
    } as any);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.physicalProducts.create({
      name: "Test Product",
      price: 10000,
      type: "إلكتروني",
      description: "Test",
    });

    expect(result.id).toBe(1);
  });

  it("should delete a product as admin", async () => {
    vi.mocked(db.deletePhysicalProduct).mockResolvedValue(undefined as any);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.physicalProducts.delete({ id: 1 });

    expect(result.success).toBe(true);
  });
});

describe("Dashboard Stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should get dashboard stats as admin", async () => {
    vi.mocked(db.getDashboardStats).mockResolvedValue({
      totalPhysicalOrders: 50,
      totalDigitalSales: 30,
      totalRevenue: 5000000,
      totalMerchants: 10,
      totalAdminProfit: 2000000,
      totalMerchantEarnings: 3000000,
      returnedOrders: 5,
      cancelledOrders: 3,
    } as any);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.stats();

    expect(result.totalPhysicalOrders).toBe(50);
    expect(result.totalDigitalSales).toBe(30);
    expect(result.totalRevenue).toBe(5000000);
    expect(result.totalMerchants).toBe(10);
  });

  it("should get daily sales stats as admin", async () => {
    vi.mocked(db.getDailySalesStats).mockResolvedValue([
      { date: "2026-07-20", physicalOrders: 5, digitalSales: 3, physicalRevenue: 100000, digitalRevenue: 50000 },
    ] as any);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.dailySales({ days: 30 });

    expect(result).toHaveLength(1);
    expect(result[0].physicalOrders).toBe(5);
  });
});

describe("Merchants Management (admin-only creation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list all merchants as admin", async () => {
    vi.mocked(db.getAllMerchants).mockResolvedValue([
      { id: 1, name: "Merchant 1", username: "merchant1", passcode: "1234",
        merchantType: "physical", commission: 1000, digitalLevel: "1",
        failedAttempts: 0, lockedUntil: null,
        createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    ] as any);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.merchants.list();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Merchant 1");
  });

  it("should create a merchant as admin", async () => {
    vi.mocked(db.createMerchantByAdmin).mockResolvedValue({
      id: 1, name: "New Merchant", username: "newmerchant", passcode: "1234",
      merchantType: "physical", commission: 1000, digitalLevel: "1",
      failedAttempts: 0, lockedUntil: null,
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: null,
    } as any);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.merchants.create({
      name: "New Merchant",
      username: "newmerchant",
      passcode: "1234",
      merchantType: "physical",
      commission: 1000,
      digitalLevel: "1",
    });

    expect(result.id).toBe(1);
    expect(result.name).toBe("New Merchant");
  });

  it("should delete a merchant as admin", async () => {
    vi.mocked(db.deleteMerchant).mockResolvedValue(undefined as any);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.merchants.delete({ id: 1 });

    expect(result.success).toBe(true);
  });

  it("should reset merchant password as admin", async () => {
    vi.mocked(db.updateMerchantPasscode).mockResolvedValue(undefined as any);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.merchants.resetPassword({
      id: 1,
      newPasscode: "newpass123",
    });

    expect(result.success).toBe(true);
  });

  it("should reject merchant creation from anonymous user", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.merchants.create({
        name: "New Merchant",
        username: "newmerchant",
        passcode: "1234",
        merchantType: "physical",
        commission: 1000,
        digitalLevel: "1",
      })
    ).rejects.toThrow();
  });
});

describe("Settlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject settlements.myBalance for an anonymous caller (no merchant session)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.settlements.myBalance()).rejects.toThrow();
  });

  it("should scope settlements.myBalance to the session's own merchant, never a client-supplied id (IDOR fix)", async () => {
    vi.mocked(db.getUnsettledBalanceForMerchant).mockResolvedValue({
      amount: 5000, deliveredCount: 2, cancelledCount: 1, deliveredRows: [],
    });

    const ctx = createMerchantContext(7);
    const caller = appRouter.createCaller(ctx);
    await caller.settlements.myBalance();

    // The router must pass the whole ctx.merchant object through (id=7), it
    // must never accept or forward a client-supplied merchantId.
    expect(db.getUnsettledBalanceForMerchant).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7 })
    );
  });

  it("should reject settlements.myHistory for an anonymous caller", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.settlements.myHistory()).rejects.toThrow();
  });

  it("should scope settlements.myHistory to the session's own merchant id, never a client-supplied one (IDOR fix)", async () => {
    vi.mocked(db.getSettlementsByMerchant).mockResolvedValue([]);

    const ctx = createMerchantContext(7);
    const caller = appRouter.createCaller(ctx);
    await caller.settlements.myHistory();

    expect(db.getSettlementsByMerchant).toHaveBeenCalledWith(7);
    expect(db.getSettlementsByMerchant).not.toHaveBeenCalledWith(99);
  });

  it("should reject settlements.create for an anonymous caller (admin-only gate)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.settlements.create({ merchantId: 1 })
    ).rejects.toThrow();
  });

  it("should reject settlements.create for a logged-in merchant (admin-only, not merchant-self-service)", async () => {
    const ctx = createMerchantContext(1);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.settlements.create({ merchantId: 1 })
    ).rejects.toThrow();
  });

  it("should settle the resolved merchant's balance as admin", async () => {
    vi.mocked(db.getMerchantById).mockResolvedValue({
      id: 3, name: "Test Merchant", username: "testuser", passcode: "1234",
      merchantType: "physical", commission: 1000, digitalLevel: "1",
      failedAttempts: 0, lockedUntil: null,
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    } as any);
    vi.mocked(db.createSettlement).mockResolvedValue({
      id: 10, merchantId: 3, merchantName: "Test Merchant", merchantType: "physical",
      amount: 3000, deliveredCount: 3, cancelledCount: 0, note: "دفعة نقدية",
      createdAt: new Date(),
    } as any);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.settlements.create({ merchantId: 3, note: "دفعة نقدية" });

    expect(db.createSettlement).toHaveBeenCalledWith(
      expect.objectContaining({ id: 3 }),
      "دفعة نقدية"
    );
    expect(result.amount).toBe(3000);
  });

  it("should throw when settling a merchant that no longer exists", async () => {
    vi.mocked(db.getMerchantById).mockResolvedValue(undefined as any);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.settlements.create({ merchantId: 999 })
    ).rejects.toThrow();
    expect(db.createSettlement).not.toHaveBeenCalled();
  });

  it("should list settlements filtered as admin", async () => {
    vi.mocked(db.getFilteredSettlements).mockResolvedValue([]);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await caller.settlements.list({ merchantId: 3 });

    expect(db.getFilteredSettlements).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId: 3 })
    );
  });

  it("should reject settlements.list for a non-admin caller", async () => {
    const ctx = createMerchantContext(1);
    const caller = appRouter.createCaller(ctx);

    await expect(caller.settlements.list({})).rejects.toThrow();
  });
});

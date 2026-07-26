import { COOKIE_NAME } from "@shared/const";
import type { Request } from "express";
import { z } from "zod";
import { getSessionCookieOptions, isSecureRequest } from "./_core/cookies";
import { notifyOwner } from "./_core/notification";
import { sdk } from "./_core/sdk";
import { storagePut } from "./storage";
import { systemRouter } from "./_core/systemRouter";
import { appAdminProcedure, merchantProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";

// ==================== Merchant Auth ====================

const MERCHANT_COOKIE_NAME = "merchant_session";

function setMerchantCookie(req: Request, res: any, token: string) {
  const secure = isSecureRequest(req);
  const options = {
    httpOnly: true,
    path: "/",
    sameSite: (secure ? "none" : "lax") satisfies "none" | "lax",
    secure,
    maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
  };
  res.cookie(MERCHANT_COOKIE_NAME, token, options);
}

function clearMerchantCookie(req: Request, res: any) {
  const secure = isSecureRequest(req);
  const options = {
    httpOnly: true,
    path: "/",
    sameSite: (secure ? "none" : "lax") satisfies "none" | "lax",
    secure,
    maxAge: -1,
  };
  res.clearCookie(MERCHANT_COOKIE_NAME, options);
}

// ==================== Admin Auth ====================

const ADMIN_COOKIE_NAME = "admin_session";

function setAdminCookie(req: Request, res: any, token: string) {
  const secure = isSecureRequest(req);
  const options = {
    httpOnly: true,
    path: "/",
    sameSite: (secure ? "none" : "lax") satisfies "none" | "lax",
    secure,
    maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
  };
  res.cookie(ADMIN_COOKIE_NAME, token, options);
}

function clearAdminCookie(req: Request, res: any) {
  const secure = isSecureRequest(req);
  const options = {
    httpOnly: true,
    path: "/",
    sameSite: (secure ? "none" : "lax") satisfies "none" | "lax",
    secure,
    maxAge: -1,
  };
  res.clearCookie(ADMIN_COOKIE_NAME, options);
}

// Shared by physicalProducts.create/update — same base64-upload pattern as
// digitalSales.create's proof image (see below), reused here to avoid
// duplicating the decode/upload try-catch twice.
async function uploadProductImage(base64?: string, name?: string): Promise<{ imageKey?: string; imageUrl?: string }> {
  if (!base64 || !name) return {};
  try {
    const base64Data = base64.split(",")[1] || base64;
    const buffer = Buffer.from(base64Data, "base64");
    const ext = name.split(".").pop() || "jpg";
    const result = await storagePut(`products/${Date.now()}.${ext}`, buffer, `image/${ext}`);
    return { imageKey: result.key, imageUrl: result.url };
  } catch (error) {
    console.error("[PhysicalProduct] Failed to upload image:", error);
    return {};
  }
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ==================== Merchant Auth ====================
  merchant: router({
    // Login with username + passcode (no open signup)
    login: publicProcedure
      .input(z.object({
        username: z.string().min(2).max(255),
        passcode: z.string().min(4).max(32),
      }))
      .mutation(async ({ input, ctx }) => {
        const merchant = await db.getMerchantByUsername(input.username);
        if (!merchant) {
          throw new Error("اسم المستخدم غير مسجل");
        }
        // Check brute-force lock
        if (merchant.lockedUntil && new Date(merchant.lockedUntil) > new Date()) {
          const remaining = Math.ceil((new Date(merchant.lockedUntil).getTime() - Date.now()) / 60000);
          throw new Error(`تم قفل الحساب مؤقتاً. حاول بعد ${remaining} دقيقة`);
        }
        if (merchant.passcode !== input.passcode) {
          const attempts = await db.incrementFailedAttempts(merchant.id);
          if (attempts >= 5) {
            throw new Error("تم قفل الحساب لمدة 15 دقيقة بسبب 5 محاولات خاطئة");
          }
          throw new Error(`رمز الدخول غير صحيح. المحاولات المتبقية: ${5 - attempts}`);
        }
        // Reset failed attempts on successful login
        await db.resetFailedAttempts(merchant.id);
        const token = await sdk.createSessionToken(`merchant:${merchant.id}`, {
          name: merchant.name,
        });
        setMerchantCookie(ctx.req, ctx.res, token);
        await db.updateMerchantLastSignIn(merchant.id);
        return {
          id: merchant.id,
          name: merchant.name,
          username: merchant.username,
          merchantType: merchant.merchantType,
        };
      }),

    me: publicProcedure.query(async ({ ctx }) => {
      const cookies = ctx.req.headers.cookie || "";
      const merchantCookie = cookies
        .split(";")
        .map(s => s.trim())
        .find(s => s.startsWith(`${MERCHANT_COOKIE_NAME}=`));
      if (!merchantCookie) return null;
      const token = merchantCookie.split("=")[1];
      if (!token) return null;
      try {
        const session = await sdk.verifySession(token);
        if (!session || !session.openId.startsWith("merchant:")) return null;
        const merchantId = parseInt(session.openId.split(":")[1]);
        const merchant = await db.getMerchantById(merchantId);
        if (!merchant) return null;
        return {
          id: merchant.id,
          name: merchant.name,
          username: merchant.username,
          merchantType: merchant.merchantType,
        };
      } catch {
        return null;
      }
    }),

    logout: publicProcedure.mutation(({ ctx }) => {
      clearMerchantCookie(ctx.req, ctx.res);
      return { success: true };
    }),
  }),

  // ==================== Admin Auth (internal admins table) ====================
  admin: router({
    // Login with username + passcode against the internal `admins` table.
    // Completely separate from merchant login and from Manus OAuth.
    login: publicProcedure
      .input(z.object({
        username: z.string().min(2).max(255),
        passcode: z.string().min(4).max(32),
      }))
      .mutation(async ({ input, ctx }) => {
        const admin = await db.getAdminByUsername(input.username);
        if (!admin) {
          throw new Error("اسم المستخدم غير مسجل");
        }
        // Check brute-force lock
        if (admin.lockedUntil && new Date(admin.lockedUntil) > new Date()) {
          const remaining = Math.ceil((new Date(admin.lockedUntil).getTime() - Date.now()) / 60000);
          throw new Error(`تم قفل الحساب مؤقتاً. حاول بعد ${remaining} دقيقة`);
        }
        if (admin.passcode !== input.passcode) {
          const attempts = await db.incrementAdminFailedAttempts(admin.id);
          if (attempts >= 5) {
            throw new Error("تم قفل الحساب لمدة 15 دقيقة بسبب 5 محاولات خاطئة");
          }
          throw new Error(`رمز الدخول غير صحيح. المحاولات المتبقية: ${5 - attempts}`);
        }
        // Reset failed attempts on successful login
        await db.resetAdminFailedAttempts(admin.id);
        const token = await sdk.createSessionToken(`admin:${admin.id}`, {
          name: admin.name,
        });
        setAdminCookie(ctx.req, ctx.res, token);
        return {
          id: admin.id,
          name: admin.name,
          username: admin.username,
        };
      }),

    me: publicProcedure.query(({ ctx }) => {
      if (!ctx.admin) return null;
      return {
        id: ctx.admin.id,
        name: ctx.admin.name,
        username: ctx.admin.username,
      };
    }),

    logout: publicProcedure.mutation(({ ctx }) => {
      clearAdminCookie(ctx.req, ctx.res);
      return { success: true };
    }),
  }),

  // ==================== Physical Orders ====================
  physicalOrders: router({
    create: merchantProcedure
      .input(z.object({
        merchantName: z.string(),
        customerName: z.string().min(2).max(255),
        customerPhone: z.string().min(6).max(20),
        productType: z.string().min(1).max(255),
        productPrice: z.number().int().min(0),
        quantity: z.number().int().min(1).default(1),
        province: z.string().min(1).max(255),
        district: z.string().min(1).max(255),
        notes: z.string().optional(),
        productId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const totalPrice = input.productPrice * input.quantity;
        const order = await db.createPhysicalOrder({
          ...input,
          merchantId: ctx.merchant.id,
          totalPrice,
          // Freeze the merchant's commission as it stands right now — a later
          // commission change must never retroactively change this order.
          commissionAtOrderTime: ctx.merchant.commission,
        });
        // Notify owner
        try {
          await notifyOwner({
            title: "طلب جديد - EBOMA",
            content: `طلب جديد من التاجر ${input.merchantName}\nالعميل: ${input.customerName}\nالمنتج: ${input.productType}\nالكمية: ${input.quantity}\nالإجمالي: ${totalPrice}\nالعنوان: ${input.province} - ${input.district}`,
          });
        } catch {}
        return order;
      }),

    myOrders: merchantProcedure
      .query(async ({ ctx }) => {
        return await db.getPhysicalOrdersByMerchant(ctx.merchant.id);
      }),

    list: appAdminProcedure.query(async () => {
      return await db.getAllPhysicalOrders();
    }),

    updateStatus: appAdminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["new", "preparing", "shipped", "delivered", "cancelled", "returned"]),
      }))
      .mutation(async ({ input }) => {
        await db.updatePhysicalOrderStatus(input.id, input.status);
        return { success: true };
      }),

    filtered: appAdminProcedure
      .input(z.object({
        merchantId: z.number().optional(),
        productType: z.string().optional(),
        status: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getFilteredPhysicalOrders(input);
      }),
  }),

  // ==================== Digital Sales ====================
  digitalSales: router({
    create: merchantProcedure
      .input(z.object({
        merchantName: z.string(),
        customerPhone: z.string().min(6).max(20),
        productType: z.string().min(1).max(255),
        productPrice: z.number().int().min(0),
        proofImageBase64: z.string().min(1, "يجب رفع صورة إثبات التحويل قبل توثيق العملية"),
        proofImageName: z.string().min(1, "يجب رفع صورة إثبات التحويل قبل توثيق العملية"),
      }))
      .mutation(async ({ input, ctx }) => {
        let proofImageKey: string | undefined;
        let proofImageUrl: string | undefined;

        if (input.proofImageBase64 && input.proofImageName) {
          try {
            const base64Data = input.proofImageBase64.split(",")[1] || input.proofImageBase64;
            const buffer = Buffer.from(base64Data, "base64");
            const ext = input.proofImageName.split(".").pop() || "jpg";
            const result = await storagePut(`proofs/${Date.now()}.${ext}`, buffer, `image/${ext}`);
            proofImageKey = result.key;
            proofImageUrl = result.url;
          } catch (error) {
            console.error("[DigitalSale] Failed to upload proof image:", error);
          }
        }

        const sale = await db.createDigitalSale({
          merchantId: ctx.merchant.id,
          merchantName: input.merchantName,
          customerPhone: input.customerPhone,
          productType: input.productType,
          productPrice: input.productPrice,
          proofImageKey,
          proofImageUrl,
          // Freeze the merchant's commission level as it stands right now — a
          // later level upgrade must never retroactively change this sale.
          digitalLevelAtSaleTime: ctx.merchant.digitalLevel,
        });

        // Notify owner
        try {
          await notifyOwner({
            title: "عملية بيع رقمية جديدة - EBOMA",
            content: `عملية بيع رقمية جديدة من التاجر ${input.merchantName}\nرقم الزبون: ${input.customerPhone}\nالمنتج: ${input.productType}\nالسعر: ${input.productPrice}\nالحالة: تم التسليم`,
          });
        } catch {}

        return sale;
      }),

    mySales: merchantProcedure
      .query(async ({ ctx }) => {
        return await db.getDigitalSalesByMerchant(ctx.merchant.id);
      }),

    list: appAdminProcedure.query(async () => {
      return await db.getAllDigitalSales();
    }),

    filtered: appAdminProcedure
      .input(z.object({
        merchantId: z.number().optional(),
        productType: z.string().optional(),
        status: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getFilteredDigitalSales(input);
      }),
  }),

  // ==================== Physical Products (Admin) ====================
  physicalProducts: router({
    // Public/merchant-facing — never includes stock (see db.getAllPhysicalProducts).
    list: publicProcedure.query(async () => {
      return await db.getAllPhysicalProducts();
    }),

    // Admin-only — full rows including stock, for AdminProducts.tsx.
    listAdmin: appAdminProcedure.query(async () => {
      return await db.getAllPhysicalProductsAdmin();
    }),

    create: appAdminProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        price: z.number().int().min(0),
        type: z.string().min(1).max(255),
        description: z.string().optional(),
        stock: z.number().int().default(0),
        imageBase64: z.string().optional(),
        imageName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { imageBase64, imageName, ...productData } = input;
        const { imageKey, imageUrl } = await uploadProductImage(imageBase64, imageName);
        return await db.createPhysicalProduct({ ...productData, imageKey, imageUrl });
      }),

    update: appAdminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        price: z.number().int().min(0).optional(),
        type: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        stock: z.number().int().optional(),
        imageBase64: z.string().optional(),
        imageName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, imageBase64, imageName, ...data } = input;
        const { imageKey, imageUrl } = await uploadProductImage(imageBase64, imageName);
        await db.updatePhysicalProduct(id, {
          ...data,
          ...(imageKey && imageUrl ? { imageKey, imageUrl } : {}),
        });
        return { success: true };
      }),

    delete: appAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePhysicalProduct(input.id);
        return { success: true };
      }),
  }),

  // ==================== Digital Products (Admin) ====================
  digitalProducts: router({
    list: publicProcedure.query(async () => {
      return await db.getAllDigitalProducts();
    }),

    create: appAdminProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        price: z.number().int().min(0),
        type: z.string().min(1).max(255),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createDigitalProduct(input);
      }),

    update: appAdminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        price: z.number().int().min(0).optional(),
        type: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateDigitalProduct(id, data);
        return { success: true };
      }),

    delete: appAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteDigitalProduct(input.id);
        return { success: true };
      }),
  }),

  // ==================== Merchants Management (Admin) ====================
  merchants: router({
    list: appAdminProcedure.query(async () => {
      return await db.getAllMerchants();
    }),

    performance: appAdminProcedure.query(async () => {
      return await db.getMerchantPerformance();
    }),

    // Admin creates merchant accounts (no open signup)
    create: appAdminProcedure
      .input(z.object({
        name: z.string().min(2).max(255),
        username: z.string().min(2).max(255),
        passcode: z.string().min(4).max(32),
        merchantType: z.enum(["physical", "digital"]),
        commission: z.number().int().min(0).default(0), // fixed IQD per order for physical
        digitalLevel: z.enum(["1", "2", "3"]).default("1"), // commission level for digital
      }))
      .mutation(async ({ input }) => {
        const merchant = await db.createMerchantByAdmin(input);
        return {
          id: merchant.id,
          name: merchant.name,
          username: merchant.username,
          merchantType: merchant.merchantType,
        };
      }),

    // Admin upgrades digital merchant level
    upgradeLevel: appAdminProcedure
      .input(z.object({
        id: z.number(),
        level: z.enum(["1", "2", "3"]),
      }))
      .mutation(async ({ input }) => {
        await db.updateMerchantLevel(input.id, input.level);
        return { success: true };
      }),

    delete: appAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteMerchant(input.id);
        return { success: true };
      }),

    // Admin resets merchant password (no OTP, no SMS, admin-only)
    resetPassword: appAdminProcedure
      .input(z.object({
        id: z.number(),
        newPasscode: z.string().min(4).max(32),
      }))
      .mutation(async ({ input }) => {
        await db.updateMerchantPasscode(input.id, input.newPasscode);
        return { success: true };
      }),
  }),

  // ==================== Settlements ====================
  settlements: router({
    // Admin-only: full-sweep settle a merchant's entire current unsettled
    // balance in one atomic transaction (see db.createSettlement). merchantId
    // is admin-supplied by design — admin acts on behalf of any merchant,
    // contrast with the merchant-facing endpoints below which never take a
    // client-supplied merchantId.
    create: appAdminProcedure
      .input(z.object({
        merchantId: z.number(),
        note: z.string().max(1000).optional(),
      }))
      .mutation(async ({ input }) => {
        const merchant = await db.getMerchantById(input.merchantId);
        if (!merchant) throw new Error("التاجر غير موجود");
        const settlement = await db.createSettlement(merchant, input.note);
        try {
          await notifyOwner({
            title: "تسوية أرباح جديدة - EBOMA",
            content: `تمت تسوية أرباح التاجر ${merchant.name}\nالمبلغ: ${settlement.amount}\nعدد الطلبات المسلمة: ${settlement.deliveredCount}\nعدد الملغاة/المرتجعة: ${settlement.cancelledCount}`,
          });
        } catch {}
        return settlement;
      }),

    // Admin audit trail, optionally filtered.
    list: appAdminProcedure
      .input(z.object({
        merchantId: z.number().optional(),
        merchantType: z.enum(["physical", "digital"]).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getFilteredSettlements(input);
      }),

    // Merchant-facing: own current unsettled balance + the delivered rows
    // that make it up. Uses ctx.merchant.id only — never a client-supplied
    // merchantId (same IDOR-safe convention as physicalOrders.myOrders).
    myBalance: merchantProcedure.query(async ({ ctx }) => {
      return await db.getUnsettledBalanceForMerchant(ctx.merchant);
    }),

    // Merchant-facing: own settlement history.
    myHistory: merchantProcedure.query(async ({ ctx }) => {
      return await db.getSettlementsByMerchant(ctx.merchant.id);
    }),
  }),

  // ==================== Dashboard Stats (Admin) ====================
  dashboard: router({
    stats: appAdminProcedure.query(async () => {
      return await db.getDashboardStats();
    }),

    dailySales: appAdminProcedure
      .input(z.object({ days: z.number().int().min(1).max(90).default(30) }))
      .query(async ({ input }) => {
        return await db.getDailySalesStats(input.days);
      }),
  }),
});

export type AppRouter = typeof appRouter;

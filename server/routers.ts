import { COOKIE_NAME } from "@shared/const";
import type { Request } from "express";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions, isSecureRequest } from "./_core/cookies";
import { notifyOwner, sendTelegramNotification } from "./_core/notification";
import { sdk } from "./_core/sdk";
import { storagePut } from "./storage";
import { systemRouter } from "./_core/systemRouter";
import { appAdminProcedure, merchantProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { comparePassword } from "./lib/password";

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

// Same base64-upload pattern as uploadProductImage above, for
// profitSettlements.promotionProofUrl - admin uploads a proof-of-cost image
// when confirming a hierarchical profit settlement. No imageKey needed here
// (unlike products, a promotion proof is never deleted/replaced afterward).
async function uploadPromotionProofImage(base64?: string, name?: string): Promise<{ url?: string }> {
  if (!base64 || !name) return {};
  try {
    const base64Data = base64.split(",")[1] || base64;
    const buffer = Buffer.from(base64Data, "base64");
    const ext = name.split(".").pop() || "jpg";
    const result = await storagePut(`promotion-proofs/${Date.now()}.${ext}`, buffer, `image/${ext}`);
    return { url: result.url };
  } catch (error) {
    console.error("[ProfitSettlement] Failed to upload promotion proof image:", error);
    return {};
  }
}

// Same base64-upload pattern as uploadPromotionProofImage above, for
// profitSettlementPayouts.proofUrl - admin uploads an optional proof-of-payment
// image when settling a merchant's outstanding balance. No imageKey needed
// here either (never deleted/replaced afterward).
async function uploadPayoutProofImage(base64?: string, name?: string): Promise<{ url?: string }> {
  if (!base64 || !name) return {};
  try {
    const base64Data = base64.split(",")[1] || base64;
    const buffer = Buffer.from(base64Data, "base64");
    const ext = name.split(".").pop() || "jpg";
    const result = await storagePut(`payout-proofs/${Date.now()}.${ext}`, buffer, `image/${ext}`);
    return { url: result.url };
  } catch (error) {
    console.error("[ProfitSettlement] Failed to upload payout proof image:", error);
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
          role: merchant.role,
          // Own override percentage - needed client-side to decide whether
          // to show the "رصيدي الحالي" balance section at all (mirrors the
          // profitSettlements.myBalance/myShareDetails/myPayouts server-side
          // gate). Safe to expose - it's the merchant's own value.
          overridePercentage: merchant.overridePercentage,
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
        if (!(await comparePassword(input.passcode, admin.passcode))) {
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
        // Merchants are either fully physical or fully digital, never both -
        // a digital-only account can't register a physical order.
        if (ctx.merchant.merchantType !== "physical") {
          throw new Error("هذا الحساب مخصص للمبيعات المادية فقط");
        }

        const totalPrice = input.productPrice * input.quantity;
        // Freeze the linked catalog product's cost fields as they stand right
        // now, same principle as the commission freeze below — undefined
        // (no productId, or product since deleted) resolves to zero cost.
        const product = input.productId ? await db.getPhysicalProductById(input.productId) : undefined;
        if (product?.minPrice != null && input.productPrice < product.minPrice) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `السعر أقل من الحد الأدنى المسموح لهذا المنتج (${product.minPrice.toLocaleString()} د.ع)`,
          });
        }
        const costs = db.computeFrozenProductCosts(product, input.quantity, totalPrice);
        const order = await db.createPhysicalOrder({
          ...input,
          merchantId: ctx.merchant.id,
          totalPrice,
          // Freeze the merchant's commission as it stands right now — a later
          // commission change must never retroactively change this order.
          commissionAtOrderTime: db.computeFrozenCommission(ctx.merchant.commissionType, ctx.merchant.commissionValue, totalPrice, input.quantity),
          ...costs,
        });
        // Notify owner
        try {
          await sendTelegramNotification(
            `طلب جديد - EBOMA\nطلب جديد من التاجر ${input.merchantName}\nالعميل: ${input.customerName}\nالمنتج: ${input.productType}\nالكمية: ${input.quantity}\nالإجمالي: ${totalPrice}\nالعنوان: ${input.province} - ${input.district}`
          );
        } catch {}
        return order;
      }),

    myOrders: merchantProcedure
      .query(async ({ ctx }) => {
        const rows = await db.getPhysicalOrdersByMerchant(ctx.merchant.id);
        // Cost/profit fields stripped from the response for merchants
        // without canViewCosts — enforced here, not just hidden in the UI.
        return rows.map(o => db.maskPhysicalOrderForMerchant(o, ctx.merchant.canViewCosts));
      }),

    // Merchant-facing: live (unsettled) view of the caller's ENTIRE
    // subordinate tree's physical orders across every status, grouped by
    // branch (one entry per direct subordinate, including everyone under
    // them) - supervisor/leader/manager only, since sales_rep has no
    // subordinates. Independent of profitSettlements - this never waits for
    // a settlement sweep. Cost/profit fields are masked using the VIEWER's
    // own canViewCosts (ctx.merchant), not the order-owning subordinate's -
    // a per-product decision so an admin-trusted supervisor sees their
    // team's margins without granting each subordinate that flag.
    liveTeamOrders: merchantProcedure.query(async ({ ctx }) => {
      if (ctx.merchant.role === "sales_rep") {
        throw new TRPCError({ code: "FORBIDDEN", message: "هذه البيانات غير متاحة لمندوب المبيعات" });
      }
      const branches = await db.getLiveTeamOrdersByBranch(ctx.merchant.id);
      return branches.map(b => ({
        ...b,
        orders: b.orders.map(o => db.maskPhysicalOrderForMerchant(o, ctx.merchant.canViewCosts)),
      }));
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
        // Merchants are either fully physical or fully digital, never both -
        // a physical-only account can't register a digital sale.
        if (ctx.merchant.merchantType !== "digital") {
          throw new Error("هذا الحساب مخصص للمبيعات الرقمية فقط");
        }

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
          // Freeze the merchant's commission as it stands right now — a later
          // commission change must never retroactively change this sale.
          commissionAtSaleTime: db.computeFrozenCommission(ctx.merchant.commissionType, ctx.merchant.commissionValue, input.productPrice, 1),
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
        wholesaleCost: z.number().int().min(0).optional(),
        deliveryCost: z.number().int().min(0).optional(),
        minPrice: z.number().int().min(0).optional(),
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
        wholesaleCost: z.number().int().min(0).optional(),
        deliveryCost: z.number().int().min(0).optional(),
        minPrice: z.number().int().min(0).optional(),
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

    // Flat list for the org-chart page (client/src/pages/AdminOrgTree.tsx) -
    // the tree itself is assembled client-side from parentId, no recursive
    // SQL here.
    orgTree: appAdminProcedure.query(async () => {
      return await db.getMerchantsOrgTree();
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
        role: z.enum(["sales_rep", "supervisor", "leader", "manager"]).default("sales_rep"),
        parentId: z.number().nullable().default(null),
        commissionType: z.enum(["fixed", "percentage"]).default("fixed"),
        commissionValue: z.number().min(0).default(0),
        overridePercentage: z.number().min(0).max(100).nullable().default(null), // supervisor/leader/manager, never sales_rep
        canViewCosts: z.boolean().default(false), // whether merchant sees cost/profit on own orders
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

    // Admin edits an existing merchant's profile + hierarchy/commission
    // settings. Username/passcode excluded by design - see db.updateMerchantByAdmin.
    update: appAdminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(2).max(255),
        merchantType: z.enum(["physical", "digital"]),
        commission: z.number().int().min(0).default(0),
        digitalLevel: z.enum(["1", "2", "3"]).default("1"),
        role: z.enum(["sales_rep", "supervisor", "leader", "manager"]).default("sales_rep"),
        parentId: z.number().nullable().default(null),
        commissionType: z.enum(["fixed", "percentage"]).default("fixed"),
        commissionValue: z.number().min(0).default(0),
        overridePercentage: z.number().min(0).max(100).nullable().default(null),
        canViewCosts: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateMerchantByAdmin(id, data);
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

  // ==================== Profit Settlements (hierarchy commission system) ====================
  // Fully separate from `settlements` above - new sales_rep/supervisor/leader/
  // manager hierarchy flow. create/list/balances/settlePayout stay admin-only
  // (promotionCost is admin-entered by design); mySettlements/mySubordinates/
  // subordinatesSummary/myBalance/myShareDetails/myPayouts below are the
  // merchant-facing, role-gated views onto the same data. Every settlement is
  // created directly as "confirmed" (see db.createProfitSettlement) - the
  // admin's "معاينة" preview step before calling create already serves as the
  // review gate, so there's no separate draft->confirm transition anymore.
  profitSettlements: router({
    // grossProfit is no longer a client input - db.createProfitSettlement
    // derives it from delivered physicalOrders.grossProfitAtOrderTime within
    // the period (see db.ts).
    // merchantIds: usually one merchant (the original single-merchant flow),
    // or several for a "team settlement" - a supervisor/leader plus a chosen
    // subset of their DIRECT subordinates on the same ad campaign. db.ts
    // enforces server-side that anything beyond one id shares the same
    // direct parent - never trust the client on this.
    create: appAdminProcedure
      .input(z.object({
        merchantIds: z.array(z.number()).min(1),
        productId: z.number().optional(),
        periodStart: z.date(),
        periodEnd: z.date(),
        promotionCost: z.number().min(0),
        promotionProofBase64: z.string().optional(),
        promotionProofName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { promotionProofBase64, promotionProofName, ...rest } = input;
        const { url } = await uploadPromotionProofImage(promotionProofBase64, promotionProofName);
        return await db.createProfitSettlement({ ...rest, promotionProofUrl: url });
      }),

    // Admin-only, read-only: merchants with at least one delivered order not
    // yet swept into a profit settlement - populates the merchant picker on
    // the hierarchical settlements admin page (single-merchant mode).
    unsettledMerchants: appAdminProcedure.query(async () => {
      return await db.getMerchantsWithUnsettledProfitOrders();
    }),

    // Admin-only, read-only: every supervisor/leader with at least one direct
    // subordinate - populates the supervisor/leader picker for team-settlement
    // mode (step 1 of 2, before picking which of their direct subordinates to
    // include).
    groupHeads: appAdminProcedure.query(async () => {
      return await db.getGroupSettlementHeads();
    }),

    // Admin-only, read-only: a chosen supervisor/leader's DIRECT subordinates
    // only (one level down, never their whole subtree - see
    // physicalOrders.liveTeamOrders for the all-depth equivalent used
    // elsewhere) - populates the checkbox list for team-settlement mode.
    directSubordinates: appAdminProcedure
      .input(z.object({ parentMerchantId: z.number() }))
      .query(async ({ input }) => {
        return await db.getDirectSubordinates(input.parentMerchantId);
      }),

    // Admin-only, read-only: the eligible delivered orders (with their
    // frozen cost/profit snapshot) across the given merchant(s) within a
    // period - the detailed breakdown table on the admin page.
    unsettledOrders: appAdminProcedure
      .input(z.object({
        merchantIds: z.array(z.number()).min(1),
        periodStart: z.date(),
        periodEnd: z.date(),
        productId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getEligibleProfitOrders(input.merchantIds, input.periodStart, input.periodEnd, input.productId);
      }),

    // Admin-only, read-only: dry-run of create's calculation (same
    // grossProfit derivation), no DB writes - powers the "معاينة" button.
    preview: appAdminProcedure
      .input(z.object({
        merchantIds: z.array(z.number()).min(1),
        periodStart: z.date(),
        periodEnd: z.date(),
        promotionCost: z.number().min(0),
        productId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.previewProfitSettlement(input.merchantIds, input.periodStart, input.periodEnd, input.promotionCost, input.productId);
      }),

    list: appAdminProcedure
      .input(z.object({
        merchantId: z.number().optional(),
        status: z.enum(["draft", "confirmed"]).optional(),
      }))
      .query(async ({ input }) => {
        return await db.getFilteredProfitSettlements(input);
      }),

    // Admin-only, read-only: every merchant currently holding (or having
    // ever held) an ancestor override share, with their current outstanding
    // balance - powers the "أرصدة التجار" admin table.
    balances: appAdminProcedure.query(async () => {
      return await db.getMerchantsWithOverrideBalances();
    }),

    // Admin-only, read-only: every payout ever made across all merchants -
    // powers the "سجل الدفعات" admin tab (distinct from myPayouts, which is
    // merchant-facing and scoped to ctx.merchant.id only).
    allPayouts: appAdminProcedure.query(async () => {
      return await db.getAllPayouts();
    }),

    // Admin-only: sweeps a merchant's entire current outstanding balance into
    // one payout record (see db.settleMerchantPayout for the double-payment
    // guard). proofBase64/proofName are optional, uploaded the same way as
    // promotionProofBase64/promotionProofName on create above.
    settlePayout: appAdminProcedure
      .input(z.object({
        merchantId: z.number(),
        note: z.string().max(1000).optional(),
        proofBase64: z.string().optional(),
        proofName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { proofBase64, proofName, ...rest } = input;
        const { url } = await uploadPayoutProofImage(proofBase64, proofName);
        return await db.settleMerchantPayout({ ...rest, proofUrl: url });
      }),

    // Merchant-facing: own profit settlements. Uses ctx.merchant.id only -
    // never a client-supplied merchantId (same IDOR-safe convention as
    // physicalOrders.myOrders). Rejected outright for sales_rep - this is
    // their own commission from being swept into a hierarchical settlement,
    // but the product decision is to hide it entirely from this role (no
    // other surface currently exposes it - MerchantEarnings.tsx deliberately
    // excludes hierarchical profit settlements). Not an IDOR fix (this was
    // always scoped to the caller's own id) - a deliberate business-rule
    // gate, defense-in-depth against the client-side hide in MerchantTeam.tsx.
    mySettlements: merchantProcedure.query(async ({ ctx }) => {
      if (ctx.merchant.role === "sales_rep") {
        throw new TRPCError({ code: "FORBIDDEN", message: "هذه البيانات غير متاحة لمندوب المبيعات" });
      }
      const rows = await db.getProfitSettlementsByMerchant(ctx.merchant.id);
      return rows.map(row => db.maskProfitSettlementForRole(row, ctx.merchant.role));
    }),

    // Merchant-facing: direct subordinates + their settlements, for
    // supervisor/leader only (a supervisor's subordinates are sales_reps, a
    // leader's are supervisors). Not available to sales_rep (no subordinates)
    // or manager (they get the aggregated subordinatesSummary instead).
    mySubordinates: merchantProcedure.query(async ({ ctx }) => {
      if (ctx.merchant.role !== "supervisor" && ctx.merchant.role !== "leader") {
        throw new TRPCError({ code: "FORBIDDEN", message: "هذه البيانات متاحة فقط للمشرف والقائد" });
      }
      const subordinates = await db.getDirectSubordinatesWithSettlements(ctx.merchant.id);
      return subordinates.map(({ merchant, settlements }) => ({
        merchant,
        settlements: settlements.map(row => db.maskProfitSettlementForRole(row, ctx.merchant.role)),
      }));
    }),

    // Merchant-facing: manager-only rollup across their entire subordinate
    // tree (sales_reps/supervisors/leaders below them) - aggregated shares
    // only, never raw grossProfit/promotionCost.
    subordinatesSummary: merchantProcedure.query(async ({ ctx }) => {
      if (ctx.merchant.role !== "manager") {
        throw new TRPCError({ code: "FORBIDDEN", message: "هذه البيانات متاحة فقط للمدير" });
      }
      return await db.getSubordinatesSummary(ctx.merchant.id);
    }),

    // Merchant-facing: own current outstanding balance as an ancestor
    // (supervisor/leader/manager). Gated on overridePercentage being set
    // rather than role !== sales_rep - a merchant whose overridePercentage
    // was later cleared has nothing to show here, regardless of role.
    myBalance: merchantProcedure.query(async ({ ctx }) => {
      if (ctx.merchant.overridePercentage === null) {
        throw new TRPCError({ code: "FORBIDDEN", message: "هذه البيانات متاحة فقط لأصحاب حصة إضافية بالهيكل التنظيمي" });
      }
      return await db.getMerchantBalance(ctx.merchant.id);
    }),

    // Merchant-facing: full breakdown of own shares (paid/unpaid/all),
    // including the promotion-cost/proof and per-order cost detail of the
    // settlements that produced them. Masked via canViewCosts (read from
    // ctx.merchant - the session owner - never from input): true sees
    // everything, false strips every financial figure with no exception.
    myShareDetails: merchantProcedure
      .input(z.object({ filter: z.enum(["paid", "unpaid"]).optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.merchant.overridePercentage === null) {
          throw new TRPCError({ code: "FORBIDDEN", message: "هذه البيانات متاحة فقط لأصحاب حصة إضافية بالهيكل التنظيمي" });
        }
        const rows = await db.getMerchantShareDetails(ctx.merchant.id, input?.filter);
        return rows.map(row => db.maskMerchantShareDetail(row, ctx.merchant.canViewCosts));
      }),

    // Merchant-facing: own payout history.
    myPayouts: merchantProcedure.query(async ({ ctx }) => {
      if (ctx.merchant.overridePercentage === null) {
        throw new TRPCError({ code: "FORBIDDEN", message: "هذه البيانات متاحة فقط لأصحاب حصة إضافية بالهيكل التنظيمي" });
      }
      const rows = await db.getPayoutsByMerchant(ctx.merchant.id);
      return rows.map(row => db.maskPayoutPromotionProof(row, ctx.merchant.canViewCosts));
    }),

    // Merchant-facing: FULL settlement detail (grossProfit, promotionCost,
    // proof image, per-order breakdown) for ANY descendant at any depth -
    // unlike myShareDetails above, does NOT require the caller to personally
    // hold a share in that settlement. ancestorId passed to
    // getSubordinateShareDetailsForAncestor is ALWAYS ctx.merchant.id (the
    // real session owner) - never input.targetMerchantId - so a merchant can
    // never pass someone else's id and pretend to be their ancestor; db.ts's
    // isAncestorOf is the actual server-side proof of the hierarchy
    // relationship, re-checked on every call regardless of what the
    // client-side UI already restricts the picker to.
    subordinateShareDetails: merchantProcedure
      .input(z.object({ targetMerchantId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.merchant.role === "sales_rep") {
          throw new TRPCError({ code: "FORBIDDEN", message: "هذه البيانات غير متاحة لمندوب المبيعات" });
        }
        const rows = await db.getSubordinateShareDetailsForAncestor(ctx.merchant.id, input.targetMerchantId);
        // canViewCosts is the viewing ancestor's OWN flag, never the target
        // descendant's.
        return rows.map(row => db.maskSubordinateSettlementDetail(row, ctx.merchant.canViewCosts));
      }),

    // Merchant-facing: every descendant at any depth (id/name/role only) -
    // populates the "اختر تابعاً" picker for subordinateShareDetails above.
    myDescendants: merchantProcedure.query(async ({ ctx }) => {
      if (ctx.merchant.role === "sales_rep") {
        throw new TRPCError({ code: "FORBIDDEN", message: "هذه البيانات غير متاحة لمندوب المبيعات" });
      }
      const ids = await db.getAllDescendantMerchantIds(ctx.merchant.id);
      const rows = await db.getMerchantsByIds(ids);
      return rows.map(m => ({ id: m.id, name: m.name, role: m.role }));
    }),

    // Admin-only, read-only: a specific merchant's UNPAID share breakdown,
    // full detail, never masked (admin always sees everything, same
    // convention as every other admin-only endpoint in this file) - powers
    // the per-share "دفع" buttons in the "أرصدة التجار" admin table.
    merchantShareDetails: appAdminProcedure
      .input(z.object({ merchantId: z.number() }))
      .query(async ({ input }) => {
        return await db.getMerchantShareDetails(input.merchantId, "unpaid");
      }),

    // Admin-only: pays out exactly ONE outstanding share (see
    // db.settleSingleShare's double-payment guard). Fully independent of
    // settlePayout above (which sweeps ALL of a merchant's outstanding
    // shares) - both stay available side by side, unchanged.
    settleSingleShare: appAdminProcedure
      .input(z.object({
        shareId: z.number(),
        note: z.string().max(1000).optional(),
        proofBase64: z.string().optional(),
        proofName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { proofBase64, proofName, ...rest } = input;
        const { url } = await uploadPayoutProofImage(proofBase64, proofName);
        return await db.settleSingleShare({ ...rest, proofUrl: url });
      }),
  }),

  // ==================== Dashboard Stats (Admin) ====================
  dashboard: router({
    stats: appAdminProcedure.query(async () => {
      return await db.getDashboardStats();
    }),

    // Merchant-facing trust badge stats — counts only, no financial data.
    trustStats: merchantProcedure.query(async () => {
      return await db.getTrustStats();
    }),

    dailySales: appAdminProcedure
      .input(z.object({ days: z.number().int().min(1).max(90).default(30) }))
      .query(async ({ input }) => {
        return await db.getDailySalesStats(input.days);
      }),
  }),
});

export type AppRouter = typeof appRouter;

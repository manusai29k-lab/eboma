import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Admin, Merchant, User } from "../../drizzle/schema";
import * as db from "../db";
import { sdk } from "./sdk";

const ADMIN_COOKIE_NAME = "admin_session";
const MERCHANT_COOKIE_NAME = "merchant_session";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  admin: Admin | null;
  merchant: Merchant | null;
};

async function getAdminFromRequest(
  req: CreateExpressContextOptions["req"]
): Promise<Admin | null> {
  const cookies = req.headers.cookie || "";
  const adminCookie = cookies
    .split(";")
    .map(s => s.trim())
    .find(s => s.startsWith(`${ADMIN_COOKIE_NAME}=`));
  if (!adminCookie) return null;
  const token = adminCookie.split("=")[1];
  if (!token) return null;
  try {
    const session = await sdk.verifySession(token);
    if (!session || !session.openId.startsWith("admin:")) return null;
    const adminId = parseInt(session.openId.split(":")[1]);
    const admin = await db.getAdminById(adminId);
    return admin ?? null;
  } catch {
    return null;
  }
}

// Mirrors merchant.me's inline cookie/session check in routers.ts (left untouched
// there) so `merchantProcedure` can trust ctx.merchant instead of a client-supplied
// merchantId.
async function getMerchantFromRequest(
  req: CreateExpressContextOptions["req"]
): Promise<Merchant | null> {
  const cookies = req.headers.cookie || "";
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
    return merchant ?? null;
  } catch {
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  const admin = await getAdminFromRequest(opts.req);
  const merchant = await getMerchantFromRequest(opts.req);

  return {
    req: opts.req,
    res: opts.res,
    user,
    admin,
    merchant,
  };
}

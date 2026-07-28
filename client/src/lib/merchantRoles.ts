import { Headset, TrendingUp, Shield, Crown, type LucideIcon } from "lucide-react";

export type MerchantRole = "sales_rep" | "supervisor" | "leader" | "manager";

export const ROLE_CONFIG: Record<MerchantRole, { label: string; icon: LucideIcon; colorClass: string }> = {
  sales_rep: { label: "مندوب مبيعات", icon: Headset, colorClass: "text-slate-400" },
  supervisor: { label: "تاجر مشرف", icon: TrendingUp, colorClass: "text-blue-400" },
  leader: { label: "تاجر قائد", icon: Shield, colorClass: "text-purple-400" },
  manager: { label: "مدير التجار", icon: Crown, colorClass: "text-amber-400" },
};

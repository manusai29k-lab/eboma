import { Headset, TrendingUp, Shield, Crown, type LucideIcon } from "lucide-react";

export type MerchantRole = "sales_rep" | "supervisor" | "leader" | "manager";

export const ROLE_CONFIG: Record<MerchantRole, { label: string; icon: LucideIcon; colorClass: string }> = {
  sales_rep: { label: "مندوب مبيعات", icon: Headset, colorClass: "text-slate-400" },
  supervisor: { label: "تاجر مشرف", icon: TrendingUp, colorClass: "text-blue-400" },
  leader: { label: "تاجر قائد", icon: Shield, colorClass: "text-purple-400" },
  manager: { label: "مدير التجار", icon: Crown, colorClass: "text-amber-400" },
};

// Per-role visual language for the org-chart (AdminOrgTree) node cards and
// connector lines - a superset of ROLE_CONFIG's plain text color, adding the
// glow/border Tailwind classes and a raw hex (for SVG stroke/gradient, which
// can't consume Tailwind classes). Kept alongside ROLE_CONFIG rather than
// merged into it so every other ROLE_CONFIG consumer (RoleBadge,
// MerchantParentCombobox, AdminMerchants selects) stays unaffected.
export const ROLE_VISUALS: Record<MerchantRole, {
  border: string;
  glow: string;
  hoverGlow: string;
  chipBg: string;
  laneBar: string;
  hex: string;
}> = {
  sales_rep: {
    border: "border-slate-400/30",
    glow: "shadow-[0_0_16px_-4px_rgba(148,163,184,0.35)]",
    hoverGlow: "hover:shadow-[0_0_22px_-2px_rgba(148,163,184,0.55)]",
    chipBg: "bg-slate-400/10 text-slate-300",
    laneBar: "bg-slate-400/50",
    hex: "#94a3b8",
  },
  supervisor: {
    border: "border-blue-400/30",
    glow: "shadow-[0_0_16px_-4px_rgba(96,165,250,0.4)]",
    hoverGlow: "hover:shadow-[0_0_22px_-2px_rgba(96,165,250,0.6)]",
    chipBg: "bg-blue-400/10 text-blue-300",
    laneBar: "bg-blue-400/60",
    hex: "#60a5fa",
  },
  leader: {
    border: "border-purple-400/30",
    glow: "shadow-[0_0_16px_-4px_rgba(192,132,252,0.4)]",
    hoverGlow: "hover:shadow-[0_0_22px_-2px_rgba(192,132,252,0.6)]",
    chipBg: "bg-purple-400/10 text-purple-300",
    laneBar: "bg-purple-400/60",
    hex: "#c084fc",
  },
  manager: {
    border: "border-amber-400/40",
    glow: "shadow-[0_0_20px_-4px_rgba(251,191,36,0.45)]",
    hoverGlow: "hover:shadow-[0_0_28px_-2px_rgba(251,191,36,0.65)]",
    chipBg: "bg-amber-400/10 text-amber-300",
    laneBar: "bg-amber-400/70",
    hex: "#fbbf24",
  },
};

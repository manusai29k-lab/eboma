import { ChevronDown, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_CONFIG, ROLE_VISUALS } from "@/lib/merchantRoles";
import type { MerchantRole } from "@shared/merchantHierarchy";

export interface OrgNodeCardData {
  id: number;
  name: string;
  role: MerchantRole;
  commissionType: "fixed" | "percentage";
  commissionValue: number;
}

function formatCommission(node: OrgNodeCardData) {
  return node.commissionType === "fixed"
    ? `${node.commissionValue.toLocaleString()} د.ع`
    : `${node.commissionValue}%`;
}

interface OrgNodeCardProps {
  node: OrgNodeCardData;
  registerRef: (el: HTMLDivElement | null) => void;
  hasChildren: boolean;
  isCollapsed: boolean;
  hiddenDescendantCount: number;
  onToggle: () => void;
}

// Single org-chart node - the visual counterpart to OrgConnectors' lines.
// Positioned by normal flex flow inside OrgRoleLane; its ref is registered
// with OrgTreeCanvas so the connector <svg> can measure its exact on-screen
// rect after layout.
export function OrgNodeCard({ node, registerRef, hasChildren, isCollapsed, hiddenDescendantCount, onToggle }: OrgNodeCardProps) {
  const config = ROLE_CONFIG[node.role];
  const visuals = ROLE_VISUALS[node.role];
  const Icon = config.icon;

  return (
    <div
      ref={registerRef}
      className={cn(
        "relative flex min-w-[168px] shrink-0 flex-col gap-2 rounded-xl border bg-card/90 px-4 py-3 backdrop-blur-sm transition-all duration-200",
        visuals.border,
        visuals.glow,
        visuals.hoverGlow,
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("w-4 h-4 shrink-0", config.colorClass)} />
        <span className="font-semibold text-sm truncate">{node.name}</span>
      </div>
      <span className={cn("inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium", visuals.chipBg)}>
        {formatCommission(node)}
      </span>

      {hasChildren && (
        <button
          type="button"
          onClick={onToggle}
          title={isCollapsed ? "توسيع الفرع" : "طي الفرع"}
          className={cn(
            "absolute -bottom-3 start-1/2 -translate-x-1/2 flex items-center justify-center w-6 h-6 rounded-full border bg-card text-muted-foreground hover:text-foreground transition-colors",
            visuals.border,
          )}
        >
          {isCollapsed ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      )}

      {isCollapsed && hiddenDescendantCount > 0 && (
        <span
          className={cn(
            "absolute -top-2 -end-2 flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full text-[10px] font-bold border bg-card",
            visuals.border,
          )}
        >
          +{hiddenDescendantCount}
        </span>
      )}
    </div>
  );
}

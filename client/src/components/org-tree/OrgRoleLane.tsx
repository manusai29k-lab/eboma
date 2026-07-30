import { cn } from "@/lib/utils";
import { ROLE_CONFIG, ROLE_VISUALS } from "@/lib/merchantRoles";
import type { MerchantRole } from "@shared/merchantHierarchy";
import { OrgNodeCard, type OrgNodeCardData } from "./OrgNodeCard";

interface OrgRoleLaneProps {
  role: MerchantRole;
  nodes: OrgNodeCardData[];
  registerNodeRef: (id: number) => (el: HTMLDivElement | null) => void;
  childrenCountOf: (id: number) => number;
  descendantCountOf: (id: number) => number;
  collapsed: Set<number>;
  onToggle: (id: number) => void;
}

// One fixed horizontal row of the org chart, grouped strictly by role (not
// tree depth) per the design - manager/leader/supervisor/sales_rep each get
// their own row regardless of how deep a given node actually sits in the
// parentId chain. A thin colored bar + role icon/label anchor the row.
export function OrgRoleLane({ role, nodes, registerNodeRef, childrenCountOf, descendantCountOf, collapsed, onToggle }: OrgRoleLaneProps) {
  const config = ROLE_CONFIG[role];
  const visuals = ROLE_VISUALS[role];
  const Icon = config.icon;

  return (
    <div className="flex items-stretch gap-4">
      <div className={cn("w-1 self-stretch rounded-full", visuals.laneBar)} />
      <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-1 text-center">
        <Icon className={cn("w-5 h-5", config.colorClass)} />
        <span className="text-[11px] font-semibold text-muted-foreground leading-tight">{config.label}</span>
      </div>
      <div className="flex items-start gap-8 py-2">
        {nodes.map((node) => (
          <OrgNodeCard
            key={node.id}
            node={node}
            registerRef={registerNodeRef(node.id)}
            hasChildren={childrenCountOf(node.id) > 0}
            isCollapsed={collapsed.has(node.id)}
            hiddenDescendantCount={descendantCountOf(node.id)}
            onToggle={() => onToggle(node.id)}
          />
        ))}
      </div>
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import { ROLE_CONFIG, type MerchantRole } from "@/lib/merchantRoles";

export function RoleBadge({ role }: { role: MerchantRole }) {
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <Icon className={`w-3.5 h-3.5 ${config.colorClass}`} />
      {config.label}
    </Badge>
  );
}

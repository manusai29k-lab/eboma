import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ROLE_CONFIG } from "@/lib/merchantRoles";
import { checkParentAssignment, type MerchantRole } from "@shared/merchantHierarchy";

export const NO_PARENT_VALUE = "none";

interface MerchantOption {
  id: number;
  name: string;
  role: MerchantRole;
  commissionValue: number;
}

interface MerchantParentComboboxProps {
  merchants: MerchantOption[];
  value: string; // NO_PARENT_VALUE or String(id)
  onChange: (value: string) => void;
  childRole: MerchantRole;
  childCommissionValue: number;
  excludeId?: number | null; // self, when editing - never a valid parent
}

// Admin "يتبع لـ" combobox for create/edit merchant forms. Uses
// checkParentAssignment (shared/merchantHierarchy.ts) to only list merchants
// that are actually valid parents for the selected role/commission - the same
// rules the server enforces in db.validateParentAssignment, so an admin can
// never pick something the server would reject anyway.
export function MerchantParentCombobox({
  merchants,
  value,
  onChange,
  childRole,
  childCommissionValue,
  excludeId,
}: MerchantParentComboboxProps) {
  const [open, setOpen] = useState(false);

  const eligible = merchants.filter((m) => {
    if (excludeId != null && m.id === excludeId) return false;
    return checkParentAssignment(childRole, childCommissionValue, m).allowed;
  });

  const selected = value !== NO_PARENT_VALUE
    ? merchants.find((m) => String(m.id) === value)
    : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              {selected.name} — {ROLE_CONFIG[selected.role]?.label ?? selected.role}
            </span>
          ) : (
            <span className="text-muted-foreground">بدون - على القمة</span>
          )}
          <ChevronsUpDown className="opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="ابحث عن تاجر..." />
          <CommandList>
            <CommandEmpty>لا يوجد تاجر مطابق</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={NO_PARENT_VALUE}
                onSelect={() => {
                  onChange(NO_PARENT_VALUE);
                  setOpen(false);
                }}
              >
                <Check className={cn("me-2", value === NO_PARENT_VALUE ? "opacity-100" : "opacity-0")} />
                بدون - على القمة
              </CommandItem>
              {eligible.map((m) => {
                const config = ROLE_CONFIG[m.role];
                const Icon = config.icon;
                return (
                  <CommandItem
                    key={m.id}
                    value={`${m.name} ${config.label}`}
                    onSelect={() => {
                      onChange(String(m.id));
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("me-2", value === String(m.id) ? "opacity-100" : "opacity-0")} />
                    <Icon className={cn("w-4 h-4", config.colorClass)} />
                    {m.name} — {config.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

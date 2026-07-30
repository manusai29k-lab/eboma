// Single source of truth for the sales_rep/supervisor/leader/manager parentId
// hierarchy rules - imported by both server/db.ts (validateParentAssignment,
// which throws Arabic error messages) and the admin "يتبع لـ" combobox filter
// (client/src/components/MerchantParentCombobox.tsx), so the two enforcement
// points can never drift apart.
export type MerchantRole = "sales_rep" | "supervisor" | "leader" | "manager";

export type ParentAssignmentResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: "parentIsSalesRep" | "supervisorRejectsRole" | "supervisorCommissionTooHigh" | "leaderRejectsRole";
    };

export function checkParentAssignment(
  childRole: MerchantRole,
  childCommissionValue: number,
  parent: { role: MerchantRole; commissionValue: number },
): ParentAssignmentResult {
  switch (parent.role) {
    case "sales_rep":
      return { allowed: false, reason: "parentIsSalesRep" };

    case "supervisor":
      if (childRole === "sales_rep") return { allowed: true };
      if (childRole === "supervisor") {
        return childCommissionValue <= parent.commissionValue
          ? { allowed: true }
          : { allowed: false, reason: "supervisorCommissionTooHigh" };
      }
      return { allowed: false, reason: "supervisorRejectsRole" };

    case "leader":
      return childRole === "supervisor" || childRole === "leader"
        ? { allowed: true }
        : { allowed: false, reason: "leaderRejectsRole" };

    case "manager":
      return { allowed: true };
  }
}

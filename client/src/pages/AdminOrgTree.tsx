import { trpc } from "@/lib/trpc";
import { Network } from "lucide-react";
import { OrgTreeCanvas } from "@/components/org-tree/OrgTreeCanvas";

export default function AdminOrgTree() {
  const orgTree = trpc.merchants.orgTree.useQuery(undefined, { refetchOnWindowFocus: false });

  return (
    <div className="relative">
      {/* Background glow effects - consistent with the site's dark theme */}
      <div className="absolute top-0 end-1/4 w-[400px] h-[400px] bg-violet-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 start-1/4 w-[350px] h-[350px] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Network className="w-6 h-6 text-primary" />
            الهيكل التنظيمي
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            إجمالي التجار: {orgTree.data?.length ?? 0}
          </p>
        </div>

        {orgTree.isLoading ? (
          <p className="text-center text-muted-foreground py-12">جاري التحميل...</p>
        ) : orgTree.data && orgTree.data.length > 0 ? (
          <OrgTreeCanvas nodes={orgTree.data} />
        ) : (
          <p className="text-center text-muted-foreground py-12">لا يوجد تجار مسجلون بعد</p>
        )}
      </div>
    </div>
  );
}

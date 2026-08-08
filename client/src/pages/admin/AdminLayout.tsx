import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarInset, SidebarTrigger,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Package, Smartphone, Users, FileText, LogOut, BarChart3, Wallet, Network, Percent, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";

// Relative to the "/admin" nested router base (see the <Route path="/admin"
// nest> wrapper in App.tsx) — must match the inner <Switch>'s route paths
// exactly. Using absolute "/admin/..." paths here double-prepends the base
// (wouter's setLocation does `router.base + path` inside a nested router),
// producing "/admin/admin/merchants" and a blank page (no inner route
// matches).
const menuItems = [
  { icon: LayoutDashboard, label: "لوحة التحكم", path: "/" },
  { icon: Package, label: "الطلبات", path: "/orders" },
  { icon: Smartphone, label: "المنتجات", path: "/products" },
  { icon: Users, label: "التجار", path: "/merchants" },
  { icon: Network, label: "الهيكل التنظيمي", path: "/org-tree" },
  { icon: FileText, label: "التقارير", path: "/reports" },
  { icon: TrendingUp, label: "أرباح المنتجات", path: "/product-profit" },
  { icon: Wallet, label: "التسويات", path: "/settlements" },
  { icon: Percent, label: "تسويات الأرباح الهرمية", path: "/profit-settlements" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const adminMe = trpc.admin.me.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });

  const logoutMutation = trpc.admin.logout.useMutation({
    onSuccess: () => {
      utils.admin.me.setData(undefined, null);
      // "~" escapes the nested "/admin" router base — this route lives
      // outside it (same double-prepend issue as the menuItems paths above).
      setLocation("~/admin-login");
    },
  });

  // All hooks run unconditionally, before any early return, on every render.
  useEffect(() => {
    if (!adminMe.isLoading && !adminMe.data) {
      setLocation("~/admin-login"); // see comment on the logout call above
    }
  }, [adminMe.isLoading, adminMe.data, setLocation]);

  if (adminMe.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  if (adminMe.isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">حدث خطأ أثناء التحقق من الجلسة.</p>
        <button
          onClick={() => adminMe.refetch()}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (!adminMe.data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">جاري التحويل إلى صفحة الدخول...</p>
      </div>
    );
  }

  const admin = adminMe.data;
  const sidebarSide = document.documentElement.dir === "rtl" ? "right" : "left";

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" side={sidebarSide} className="border-r-0">
        {/* Header */}
        <SidebarHeader className="h-16 justify-center">
          <div className="flex items-center gap-3 px-2">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-primary-foreground shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="font-bold text-primary leading-none">EBOMA</p>
              <p className="text-xs text-muted-foreground mt-1">لوحة الإدارة</p>
            </div>
          </div>
        </SidebarHeader>

        {/* Menu */}
        <SidebarContent className="gap-0">
          <SidebarMenu className="px-2 py-1">
            {menuItems.map(item => {
              const isActive = location === item.path;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={isActive}
                    onClick={() => setLocation(item.path)}
                    tooltip={item.label}
                    className="h-10"
                  >
                    <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        {/* Footer */}
        <SidebarFooter className="p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-start group-data-[collapsible=icon]:justify-center focus:outline-none">
                <Avatar className="h-9 w-9 border shrink-0">
                  <AvatarFallback className="text-xs font-medium">
                    {(admin.name || "IW").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                  <p className="text-sm font-medium truncate leading-none">
                    {admin.name || "IBRAHIM WALEED"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-1.5">المدير</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => logoutMutation.mutate()}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="ms-2 h-4 w-4" />
                <span>تسجيل الخروج</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <div className="flex border-b h-14 items-center gap-3 px-4 bg-background/95 backdrop-blur sticky top-0 z-40">
          <SidebarTrigger className="h-9 w-9 rounded-lg" />
          <span className="font-semibold text-sm">EBOMA - نظام إدارة المبيعات</span>
        </div>
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

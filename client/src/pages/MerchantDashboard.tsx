import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Package, Smartphone, ListOrdered, LogOut, ArrowLeft, Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";

export default function MerchantDashboard() {
  const [, setLocation] = useLocation();
  const merchantMe = trpc.merchant.me.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });

  const logoutMutation = trpc.merchant.logout.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل الخروج");
      setLocation("/");
    },
  });

  const trustStats = trpc.dashboard.trustStats.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!merchantMe.isLoading && !merchantMe.data) {
      setLocation("/");
    }
  }, [merchantMe.isLoading, merchantMe.data, setLocation]);

  if (merchantMe.isLoading || !merchantMe.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060814]">
        <p className="text-white/40">جاري التحميل...</p>
      </div>
    );
  }

  const merchant = merchantMe.data;

  return (
    <div className="min-h-screen bg-[#060814] text-white relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-1/4 w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-violet-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[250px] h-[250px] md:w-[400px] md:h-[400px] bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 shadow-lg shadow-violet-500/30">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white leading-none">EBOMA</h1>
              <p className="text-[10px] text-white/40 mt-0.5">نظام إدارة المبيعات</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-left">
              <p className="text-sm font-medium text-white">{merchant.name}</p>
              <p className="text-xs text-white/40" dir="ltr">{merchant.username}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logoutMutation.mutate()}
              title="تسجيل الخروج"
              className="text-white/50 hover:text-white hover:bg-white/5"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container py-12">
        <div className="max-w-5xl mx-auto">
          {/* Founder Section */}
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">
              IBRAHIM WALEED
            </h1>
            <p className="mt-2 text-lg md:text-2xl font-bold tracking-wide bg-gradient-to-l from-violet-300 to-purple-400 bg-clip-text text-transparent">
              المؤسس والمدير التنفيذي - EBOMA
            </p>
            <p className="mt-4 max-w-2xl mx-auto text-sm md:text-base text-white/60 leading-relaxed">
              أول منصة شراكة تجارية بنظام عمولة ونسبة أرباح بالعراق وكوردستان — نمنحك فرصة البيع دون رأس مال، ونتشارك النجاح معك
            </p>

            {/* Trust Indicators */}
            <div className="flex items-center justify-center gap-4 mt-8">
              <div className="rounded-2xl bg-white/[0.03] border border-violet-500/20 px-6 py-4 min-w-[140px]">
                <p className="text-3xl font-black bg-gradient-to-l from-violet-400 to-purple-400 bg-clip-text text-transparent">
                  {trustStats.data ? trustStats.data.totalMerchants : "..."}
                </p>
                <p className="text-xs text-white/40 mt-1">تاجر مسجّل</p>
              </div>
              <div className="rounded-2xl bg-white/[0.03] border border-violet-500/20 px-6 py-4 min-w-[140px]">
                <p className="text-3xl font-black bg-gradient-to-l from-violet-400 to-purple-400 bg-clip-text text-transparent">
                  {trustStats.data ? trustStats.data.totalCompletedOrders : "..."}
                </p>
                <p className="text-xs text-white/40 mt-1">طلب منجز</p>
              </div>
            </div>
          </div>

          {/* Welcome Section */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-sm mb-4">
              <Sparkles className="w-4 h-4" />
              مرحباً بك في لوحة التاجر
            </div>
            <h2 className="text-3xl font-extrabold text-white mb-3">
              أهلاً {merchant.name}
            </h2>
            <p className="text-white/50 text-lg">اختر نوع العملية التي تريد تسجيلها</p>
          </div>

          {/* Choice Cards */}
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            {/* Physical Product */}
            <div
              className="group relative cursor-pointer rounded-3xl bg-white/[0.03] border border-violet-500/20 backdrop-blur-sm p-8 transition-all duration-300 hover:bg-white/[0.06] hover:border-violet-500/40 hover:-translate-y-1"
              onClick={() => setLocation("/merchant/physical")}
            >
              {/* Glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 shadow-lg shadow-violet-500/30 mx-auto mb-5">
                  <Package className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white text-center mb-2">منتج مادي</h3>
                <p className="text-sm text-white/50 text-center leading-relaxed mb-6">
                  تسجيل طلب لمنتج مادي يتطلب التوصيل - أدخل بيانات العميل والمنتج والعنوان
                </p>
                <Button
                  className="w-full bg-gradient-to-l from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-violet-600/20 transition-all duration-200 active:scale-[0.98]"
                >
                  تسجيل طلب جديد
                  <ArrowLeft className="w-4 h-4 ms-2" />
                </Button>
              </div>
            </div>

            {/* Digital Product */}
            <div
              className="group relative cursor-pointer rounded-3xl bg-white/[0.03] border border-emerald-500/20 backdrop-blur-sm p-8 transition-all duration-300 hover:bg-white/[0.06] hover:border-emerald-500/40 hover:-translate-y-1"
              onClick={() => setLocation("/merchant/digital")}
            >
              {/* Glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/10 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow-lg shadow-emerald-500/30 mx-auto mb-5">
                  <Smartphone className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white text-center mb-2">منتج رقمي</h3>
                <p className="text-sm text-white/50 text-center leading-relaxed mb-6">
                  توثيق بيع منتج رقمي (كورس، كتاب) مع إثبات التحويل - التسليم فوري بدون توصيل
                </p>
                <Button
                  className="w-full bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0 shadow-lg shadow-emerald-600/20 transition-all duration-200 active:scale-[0.98]"
                >
                  توثيق عملية بيع
                  <ArrowLeft className="w-4 h-4 ms-2" />
                </Button>
              </div>
            </div>
          </div>

          {/* My Orders */}
          <div
            className="group relative cursor-pointer rounded-2xl bg-white/[0.03] border border-amber-500/20 backdrop-blur-sm p-5 transition-all duration-300 hover:bg-white/[0.06] hover:border-amber-500/40"
            onClick={() => setLocation("/merchant/orders")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-700 shadow-lg shadow-amber-500/20">
                  <ListOrdered className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-white">طلباتي السابقة</p>
                  <p className="text-sm text-white/40">عرض جميع طلباتك السابقة وحالتها</p>
                </div>
              </div>
              <ArrowLeft className="w-5 h-5 text-white/30 group-hover:text-white/60 group-hover:-translate-x-1 transition-all" />
            </div>
          </div>

          {/* My Earnings */}
          <div
            className="group relative cursor-pointer rounded-2xl bg-white/[0.03] border border-teal-500/20 backdrop-blur-sm p-5 mt-4 transition-all duration-300 hover:bg-white/[0.06] hover:border-teal-500/40"
            onClick={() => setLocation("/merchant/earnings")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-700 shadow-lg shadow-teal-500/20">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-white">أرباحي</p>
                  <p className="text-sm text-white/40">رصيدك الحالي وسجل التسويات</p>
                </div>
              </div>
              <ArrowLeft className="w-5 h-5 text-white/30 group-hover:text-white/60 group-hover:-translate-x-1 transition-all" />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-6 mt-8">
        <div className="container text-center">
          <p className="text-sm text-white/30">
            EBOMA © 2026 - المؤسس والمدير IBRAHIM WALEED
          </p>
        </div>
      </footer>
    </div>
  );
}

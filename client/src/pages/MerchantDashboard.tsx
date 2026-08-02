import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Package, Smartphone, ListOrdered, LogOut, ArrowLeft, Sparkles, Wallet, Users } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function MerchantDashboard() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const merchantMe = trpc.merchant.me.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });

  const logoutMutation = trpc.merchant.logout.useMutation({
    onSuccess: () => {
      toast.success(t.common.logoutSuccess);
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
        <p className="text-white/40">{t.common.loading}</p>
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
              <p className="text-[10px] text-white/40 mt-0.5">{t.merchantDashboard.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <div className="text-left">
              <p className="text-sm font-medium text-white">{merchant.name}</p>
              <p className="text-xs text-white/40" dir="ltr">{merchant.username}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logoutMutation.mutate()}
              title={t.common.logout}
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
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight font-latin-fixed">
              IBRAHIM WALEED
            </h1>
            <p className="mt-2 text-lg md:text-2xl font-bold bg-gradient-to-l from-violet-300 to-purple-400 bg-clip-text text-transparent">
              {t.merchantDashboard.founderTitle}
            </p>
            <p className="mt-4 max-w-2xl mx-auto text-sm md:text-base text-white/60 leading-relaxed">
              {t.merchantDashboard.tagline}
            </p>

            {/* Trust Indicators */}
            <div className="flex items-center justify-center gap-4 mt-8">
              <div className="rounded-2xl bg-white/[0.03] border border-violet-500/20 px-6 py-4 min-w-[140px]">
                <p className="text-3xl font-black bg-gradient-to-l from-violet-400 to-purple-400 bg-clip-text text-transparent">
                  {trustStats.data ? `${trustStats.data.totalMerchants + 30}+` : "..."}
                </p>
                <p className="text-xs text-white/40 mt-1">{t.merchantDashboard.registeredMerchants}</p>
              </div>
              <div className="rounded-2xl bg-white/[0.03] border border-violet-500/20 px-6 py-4 min-w-[140px]">
                <p className="text-3xl font-black bg-gradient-to-l from-violet-400 to-purple-400 bg-clip-text text-transparent">
                  {/* Placeholder until real order volume is meaningful — replace with trustStats.data.totalCompletedOrders */}
                  9000
                </p>
                <p className="text-xs text-white/40 mt-1">{t.merchantDashboard.completedOrders}</p>
              </div>
            </div>
          </div>

          {/* Welcome Section */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-sm mb-4">
              <Sparkles className="w-4 h-4" />
              {t.merchantDashboard.welcomeBadge}
            </div>
            <h2 className="text-3xl font-extrabold text-white mb-3">
              {t.merchantDashboard.greeting(merchant.name)}
            </h2>
            <p className="text-white/50 text-lg">{t.merchantDashboard.chooseOperation}</p>
          </div>

          {/* Choice Card - only the merchant's own type (physical XOR digital, never both) */}
          <div className="grid gap-6 max-w-md mx-auto mb-6">
            {merchant.merchantType === "physical" ? (
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
                  <h3 className="text-xl font-bold text-white text-center mb-2">{t.merchantDashboard.physicalTitle}</h3>
                  <p className="text-sm text-white/50 text-center leading-relaxed mb-6">
                    {t.merchantDashboard.physicalDescription}
                  </p>
                  <Button
                    className="w-full bg-gradient-to-l from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-violet-600/20 transition-all duration-200 active:scale-[0.98]"
                  >
                    {t.merchantDashboard.physicalCta}
                    <ArrowLeft className="w-4 h-4 ms-2" />
                  </Button>
                </div>
              </div>
            ) : (
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
                  <h3 className="text-xl font-bold text-white text-center mb-2">{t.merchantDashboard.digitalTitle}</h3>
                  <p className="text-sm text-white/50 text-center leading-relaxed mb-6">
                    {t.merchantDashboard.digitalDescription}
                  </p>
                  <Button
                    className="w-full bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0 shadow-lg shadow-emerald-600/20 transition-all duration-200 active:scale-[0.98]"
                  >
                    {t.merchantDashboard.digitalCta}
                    <ArrowLeft className="w-4 h-4 ms-2" />
                  </Button>
                </div>
              </div>
            )}
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
                  <p className="font-bold text-white">{t.common.myOrders}</p>
                  <p className="text-sm text-white/40">{t.merchantDashboard.myOrdersDescription}</p>
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
                  <p className="font-bold text-white">{t.merchantDashboard.earningsTitle}</p>
                  <p className="text-sm text-white/40">{t.merchantDashboard.earningsDescription}</p>
                  <p className="text-xs text-white/25 mt-1">{t.merchantDashboard.earningsNote}</p>
                </div>
              </div>
              <ArrowLeft className="w-5 h-5 text-white/30 group-hover:text-white/60 group-hover:-translate-x-1 transition-all" />
            </div>
          </div>

          {/* Team Profits */}
          <div
            className="group relative cursor-pointer rounded-2xl bg-white/[0.03] border border-purple-500/20 backdrop-blur-sm p-5 mt-4 transition-all duration-300 hover:bg-white/[0.06] hover:border-purple-500/40"
            onClick={() => setLocation("/merchant/team")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-700 shadow-lg shadow-purple-500/20">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-white">{t.merchantDashboard.teamProfitsTitle}</p>
                  <p className="text-sm text-white/40">{t.merchantDashboard.teamProfitsDescription}</p>
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
            {t.merchantDashboard.footer}
          </p>
        </div>
      </footer>
    </div>
  );
}

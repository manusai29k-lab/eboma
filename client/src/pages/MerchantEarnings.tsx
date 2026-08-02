import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { ArrowRight, Wallet, CheckCircle2, XCircle, History } from "lucide-react";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function MerchantEarnings() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const merchantMe = trpc.merchant.me.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (!merchantMe.isLoading && !merchantMe.data) {
      setLocation("/");
    }
  }, [merchantMe.isLoading, merchantMe.data, setLocation]);

  const balance = trpc.settlements.myBalance.useQuery(undefined, {
    enabled: merchantMe.data !== undefined && merchantMe.data !== null,
    refetchOnWindowFocus: false,
  });

  const history = trpc.settlements.myHistory.useQuery(undefined, {
    enabled: merchantMe.data !== undefined && merchantMe.data !== null,
    refetchOnWindowFocus: false,
  });

  if (merchantMe.isLoading || !merchantMe.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060814]">
        <p className="text-white/40">{t.common.loading}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060814] text-white relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-[250px] h-[250px] md:w-[400px] md:h-[400px] bg-teal-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/merchant")} className="text-white/50 hover:text-white hover:bg-white/5">
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-700">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-bold text-white">{t.merchantEarnings.pageTitle}</h1>
          </div>
          <LanguageSwitcher className="ms-auto" />
        </div>
      </header>

      <main className="relative z-10 container py-8 max-w-4xl">
        {/* Balance summary */}
        <div className="rounded-3xl bg-white/[0.03] border border-teal-500/20 backdrop-blur-sm p-8 mb-6 text-center">
          <p className="text-sm text-white/40 mb-2">{t.merchantEarnings.currentBalanceLabel}</p>
          <p className="text-4xl font-extrabold text-teal-300 mb-6">
            {(balance.data?.amount ?? 0).toLocaleString()} {t.common.currency}
          </p>
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-white/60">{t.merchantEarnings.deliveredUnsettled}<span className="text-white font-semibold">{balance.data?.deliveredCount ?? 0}</span></span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-white/60">{t.merchantEarnings.cancelledUnsettled}<span className="text-white font-semibold">{balance.data?.cancelledCount ?? 0}</span></span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="current" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-white/5 border border-white/10 rounded-xl p-1">
            <TabsTrigger value="current" className="rounded-lg data-[state=active]:bg-teal-600 data-[state=active]:text-white text-white/50">
              <Wallet className="w-4 h-4 ms-2" />
              {t.merchantEarnings.currentBalanceTab}
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-white/50">
              <History className="w-4 h-4 ms-2" />
              {t.merchantEarnings.historyTab(history.data?.length ?? 0)}
            </TabsTrigger>
          </TabsList>

          {/* Current balance detail */}
          <TabsContent value="current">
            {balance.isLoading ? (
              <p className="text-center text-white/40 py-8">{t.common.loading}</p>
            ) : balance.data && balance.data.deliveredRows.length > 0 ? (
              <div className="space-y-3">
                {balance.data.deliveredRows.map((row) => (
                  <div key={row.id} className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 backdrop-blur-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">#{row.id}</span>
                          <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">{t.common.status.delivered}</Badge>
                        </div>
                        <p className="text-sm text-white/60 mt-1">{row.productType}</p>
                      </div>
                      <div className="text-start shrink-0">
                        <p className="text-lg font-bold text-teal-300">{row.amount.toLocaleString()} {t.common.currency}</p>
                        <p className="text-xs text-white/30 mt-1">{new Date(row.createdAt).toLocaleDateString("ar-IQ")}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Wallet className="w-12 h-12 mx-auto text-white/20 mb-3" />
                <p className="text-white/40">{t.merchantEarnings.noUnsettledBalance}</p>
              </div>
            )}
          </TabsContent>

          {/* Settlement history */}
          <TabsContent value="history">
            {history.isLoading ? (
              <p className="text-center text-white/40 py-8">{t.common.loading}</p>
            ) : history.data && history.data.length > 0 ? (
              <div className="space-y-3">
                {history.data.map((settlement) => (
                  <div key={settlement.id} className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 backdrop-blur-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">{t.merchantEarnings.profitsDelivered}</Badge>
                          <span className="text-xs text-white/30">{new Date(settlement.createdAt).toLocaleDateString("ar-IQ")}</span>
                        </div>
                        <p className="text-sm text-white/60">
                          <span className="text-white/40">{t.merchantEarnings.deliveredLabel}</span> {settlement.deliveredCount}
                          <span className="text-white/40 ms-3">{t.merchantEarnings.cancelledLabel}</span> {settlement.cancelledCount}
                        </p>
                        {settlement.note && (
                          <p className="text-sm text-white/60"><span className="text-white/40">{t.merchantEarnings.noteLabel}</span> {settlement.note}</p>
                        )}
                      </div>
                      <div className="text-start shrink-0">
                        <p className="text-lg font-bold text-teal-300">{settlement.amount.toLocaleString()} {t.common.currency}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <History className="w-12 h-12 mx-auto text-white/20 mb-3" />
                <p className="text-white/40">{t.merchantEarnings.noSettlementHistory}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

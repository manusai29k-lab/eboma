import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { ArrowRight, Package, Smartphone, ListOrdered } from "lucide-react";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  preparing: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  shipped: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  delivered: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-red-500/20 text-red-300 border-red-500/30",
  returned: "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

export default function MerchantOrders() {
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

  const physicalOrders = trpc.physicalOrders.myOrders.useQuery(undefined, {
    enabled: merchantMe.data !== undefined && merchantMe.data !== null,
    refetchOnWindowFocus: false,
  });

  const digitalSales = trpc.digitalSales.mySales.useQuery(undefined, {
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
      <div className="absolute top-0 right-1/4 w-[250px] h-[250px] md:w-[400px] md:h-[400px] bg-amber-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/merchant")} className="text-white/50 hover:text-white hover:bg-white/5">
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-700">
              <ListOrdered className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-bold text-white">{t.common.myOrders}</h1>
          </div>
          <LanguageSwitcher className="ms-auto" />
        </div>
      </header>

      <main className="relative z-10 container py-8 max-w-4xl">
        <Tabs defaultValue="physical" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-white/5 border border-white/10 rounded-xl p-1">
            <TabsTrigger value="physical" className="rounded-lg data-[state=active]:bg-violet-600 data-[state=active]:text-white text-white/50">
              <Package className="w-4 h-4 ms-2" />
              {t.merchantOrders.physicalTab(physicalOrders.data?.length ?? 0)}
            </TabsTrigger>
            <TabsTrigger value="digital" className="rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-white/50">
              <Smartphone className="w-4 h-4 ms-2" />
              {t.merchantOrders.digitalTab(digitalSales.data?.length ?? 0)}
            </TabsTrigger>
          </TabsList>

          {/* Physical Orders Tab */}
          <TabsContent value="physical">
            {physicalOrders.isLoading ? (
              <p className="text-center text-white/40 py-8">{t.common.loading}</p>
            ) : physicalOrders.data && physicalOrders.data.length > 0 ? (
              <div className="space-y-3">
                {physicalOrders.data.map((order) => (
                  <div key={order.id} className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 backdrop-blur-sm hover:bg-white/[0.05] transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">#{order.id}</span>
                          <Badge className={`${STATUS_COLORS[order.status] || "bg-white/10 text-white/60"} border`}>
                            {t.common.status[order.status as keyof typeof t.common.status] || order.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-white/60"><span className="text-white/40">{t.merchantOrders.customerLabel}</span> {order.customerName}</p>
                        <p className="text-sm text-white/60"><span className="text-white/40">{t.merchantOrders.phoneLabel}</span> <span dir="ltr">{order.customerPhone}</span></p>
                        {order.customerPhone2 && <p className="text-sm text-white/60"><span className="text-white/40">{t.merchantOrders.phone2Label}</span> <span dir="ltr">{order.customerPhone2}</span></p>}
                        {order.customerInstagram && <p className="text-sm text-white/60"><span className="text-white/40">{t.merchantOrders.instagramLabel}</span> {order.customerInstagram}</p>}
                        <p className="text-sm text-white/60"><span className="text-white/40">{t.merchantOrders.productLabel}</span> {order.productType} × {order.quantity}</p>
                        <p className="text-sm text-white/60"><span className="text-white/40">{t.merchantOrders.addressLabel}</span> {order.province} - {order.district}</p>
                        {order.notes && <p className="text-sm text-white/60"><span className="text-white/40">{t.merchantOrders.notesLabel}</span> {order.notes}</p>}
                      </div>
                      <div className="text-start shrink-0">
                        <p className="text-lg font-bold text-violet-300">{order.totalPrice.toLocaleString()} {t.common.currency}</p>
                        <p className="text-xs text-white/30 mt-1">{new Date(order.createdAt).toLocaleDateString("ar-IQ")}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="w-12 h-12 mx-auto text-white/20 mb-3" />
                <p className="text-white/40">{t.merchantOrders.noPhysicalOrders}</p>
              </div>
            )}
          </TabsContent>

          {/* Digital Sales Tab */}
          <TabsContent value="digital">
            {digitalSales.isLoading ? (
              <p className="text-center text-white/40 py-8">{t.common.loading}</p>
            ) : digitalSales.data && digitalSales.data.length > 0 ? (
              <div className="space-y-3">
                {digitalSales.data.map((sale) => (
                  <div key={sale.id} className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 backdrop-blur-sm hover:bg-white/[0.05] transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">#{sale.id}</span>
                          <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">{t.common.status.delivered}</Badge>
                        </div>
                        <p className="text-sm text-white/60"><span className="text-white/40">{t.merchantOrders.customerPhoneLabel}</span> <span dir="ltr">{sale.customerPhone}</span></p>
                        <p className="text-sm text-white/60"><span className="text-white/40">{t.merchantOrders.productLabel}</span> {sale.productType}</p>
                        {sale.proofImageUrl && (
                          <a href={sale.proofImageUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-400 hover:text-emerald-300 hover:underline">
                            {t.merchantOrders.viewProof}
                          </a>
                        )}
                      </div>
                      <div className="text-start shrink-0">
                        <p className="text-lg font-bold text-emerald-300">{sale.productPrice.toLocaleString()} {t.common.currency}</p>
                        <p className="text-xs text-white/30 mt-1">{new Date(sale.createdAt).toLocaleDateString("ar-IQ")}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Smartphone className="w-12 h-12 mx-auto text-white/20 mb-3" />
                <p className="text-white/40">{t.merchantOrders.noDigitalSales}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

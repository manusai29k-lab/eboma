import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/RoleBadge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ROLE_CONFIG } from "@/lib/merchantRoles";
import { useLocation } from "wouter";
import { ArrowRight, Users, TrendingUp, Layers, Wallet } from "lucide-react";
import { useEffect } from "react";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "مسودة", className: "bg-amber-500/20 text-amber-300 border border-amber-500/30" },
  confirmed: { label: "مؤكدة", className: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" },
};

function formatMoney(value: string | number | null) {
  if (value === null || value === undefined) return null;
  return Number(value).toLocaleString();
}

function formatPeriod(start: string | Date, end: string | Date) {
  return `${new Date(start).toLocaleDateString("ar-IQ")} - ${new Date(end).toLocaleDateString("ar-IQ")}`;
}

function SettlementRow({ settlement, viewerRole }: { settlement: any; viewerRole?: string }) {
  const status = STATUS_BADGE[settlement.status] ?? STATUS_BADGE.draft;
  const grossProfit = formatMoney(settlement.grossProfit);
  const promotionCost = formatMoney(settlement.promotionCost);
  const managerOverrideShare = formatMoney(settlement.managerOverrideShare);
  // netProfit is hidden from sales_rep viewers - merchantShare (their own cut)
  // stays visible to everyone regardless of role.
  const showNetProfit = viewerRole !== "sales_rep";

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge className={status.className}>{status.label}</Badge>
            <span className="text-xs text-white/30">{formatPeriod(settlement.periodStart, settlement.periodEnd)}</span>
          </div>
          {(grossProfit !== null || promotionCost !== null) && (
            <p className="text-sm text-white/50">
              {grossProfit !== null && <>إجمالي الربح: <span className="text-white/70">{grossProfit} د.ع</span></>}
              {promotionCost !== null && <span className="ms-3">تكلفة الترويج: <span className="text-white/70">{promotionCost} د.ع</span></span>}
            </p>
          )}
          {managerOverrideShare !== null && (
            <p className="text-sm text-white/50">حصة المدير: <span className="text-white/70">{managerOverrideShare} د.ع</span></p>
          )}
        </div>
        <div className="text-start shrink-0">
          <p className="text-lg font-bold text-purple-300">{formatMoney(settlement.merchantShare)} د.ع</p>
          {showNetProfit && (
            <p className="text-xs text-white/30 mt-1">صافي الربح: {formatMoney(settlement.netProfit)} د.ع</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MerchantTeam() {
  const [, setLocation] = useLocation();
  const merchantMe = trpc.merchant.me.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (!merchantMe.isLoading && !merchantMe.data) {
      setLocation("/");
    }
  }, [merchantMe.isLoading, merchantMe.data, setLocation]);

  const role = merchantMe.data?.role;
  const enabled = merchantMe.data !== undefined && merchantMe.data !== null;

  const mySettlements = trpc.profitSettlements.mySettlements.useQuery(undefined, {
    enabled: enabled && role !== "sales_rep",
    refetchOnWindowFocus: false,
  });

  const mySubordinates = trpc.profitSettlements.mySubordinates.useQuery(undefined, {
    enabled: enabled && (role === "supervisor" || role === "leader"),
    refetchOnWindowFocus: false,
  });

  const subordinatesSummary = trpc.profitSettlements.subordinatesSummary.useQuery(undefined, {
    enabled: enabled && role === "manager",
    refetchOnWindowFocus: false,
  });

  const hasOverride = merchantMe.data?.overridePercentage != null;

  const myBalance = trpc.profitSettlements.myBalance.useQuery(undefined, {
    enabled: enabled && hasOverride,
    refetchOnWindowFocus: false,
  });

  const myPayouts = trpc.profitSettlements.myPayouts.useQuery(undefined, {
    enabled: enabled && hasOverride,
    refetchOnWindowFocus: false,
  });

  const myShareDetails = trpc.profitSettlements.myShareDetails.useQuery({ filter: "unpaid" }, {
    enabled: enabled && hasOverride,
    refetchOnWindowFocus: false,
  });

  if (merchantMe.isLoading || !merchantMe.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060814]">
        <p className="text-white/40">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060814] text-white relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-[250px] h-[250px] md:w-[400px] md:h-[400px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/merchant")} className="text-white/50 hover:text-white hover:bg-white/5">
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-700">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">أرباح الفريق</h1>
              {role && <div className="mt-0.5"><RoleBadge role={role} /></div>}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 container py-8 max-w-4xl space-y-10">
        {/* Current balance - only for merchants holding an ancestor override
            share (supervisor/leader/manager with overridePercentage set).
            Gated on overridePercentage rather than role, mirroring the
            server-side gate on myBalance/myShareDetails/myPayouts. */}
        {role !== "sales_rep" && hasOverride && (
          <section>
            <h2 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
              <Wallet className="w-5 h-5 text-emerald-300" />
              رصيدي الحالي
            </h2>

            <div className="rounded-2xl bg-white/[0.03] border border-emerald-500/20 p-6 mb-6 text-center">
              <p className="text-3xl font-black text-emerald-300">
                {myBalance.isLoading ? "..." : `${formatMoney(myBalance.data ?? 0)} د.ع`}
              </p>
              <p className="text-xs text-white/40 mt-1">الرصيد المستحق غير المدفوع</p>
            </div>

            <div className="space-y-3 mb-6">
              <h3 className="text-sm font-semibold text-white/50">سجل الدفعات</h3>
              {myPayouts.isLoading ? (
                <p className="text-center text-white/40 py-4">جاري التحميل...</p>
              ) : myPayouts.data && myPayouts.data.length > 0 ? (
                <div className="space-y-3">
                  {myPayouts.data.map(p => (
                    <div key={p.id} className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <p className="text-sm text-white/70">{new Date(p.createdAt).toLocaleDateString("ar-IQ")}</p>
                        {p.note && <p className="text-xs text-white/30 mt-1">{p.note}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        {p.proofUrl && <img src={p.proofUrl} alt="إثبات الدفع" className="max-h-12 rounded-lg border border-white/10" />}
                        <p className="text-lg font-bold text-emerald-300">{formatMoney(p.amount)} د.ع</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/30">لا توجد دفعات سابقة</p>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white/50">تفاصيل الحصص غير المدفوعة</h3>
              {myShareDetails.isLoading ? (
                <p className="text-center text-white/40 py-4">جاري التحميل...</p>
              ) : myShareDetails.data && myShareDetails.data.length > 0 ? (
                <Accordion type="single" collapsible className="space-y-2">
                  {myShareDetails.data.map(share => (
                    <AccordionItem
                      key={share.shareId}
                      value={String(share.shareId)}
                      className="rounded-xl bg-white/[0.03] border border-white/10 px-4"
                    >
                      <AccordionTrigger className="text-white hover:no-underline">
                        <div className="flex items-center justify-between w-full pe-2 gap-3">
                          <span className="text-sm text-white/70">
                            {formatPeriod(share.settlement.periodStart, share.settlement.periodEnd)} — {share.settlement.sourceMerchantName}
                          </span>
                          <span className="text-emerald-300 font-bold shrink-0">{formatMoney(share.shareAmount)} د.ع</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pb-2">
                          <p className="text-sm text-white/50">
                            صافي الربح: <span className="text-white/70">{formatMoney(share.settlement.netProfit)} د.ع</span>
                            <span className="ms-3">كلفة الترويج: <span className="text-white/70">{formatMoney(share.settlement.promotionCost)} د.ع</span></span>
                          </p>
                          {share.settlement.promotionProofUrl && (
                            <img src={share.settlement.promotionProofUrl} alt="إثبات الترويج" className="max-h-24 rounded-lg border border-white/10" />
                          )}
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-white/40 border-b border-white/10">
                                  <th className="text-start py-1 pe-3 font-normal">المنتج</th>
                                  <th className="text-start py-1 pe-3 font-normal">الكمية</th>
                                  <th className="text-start py-1 pe-3 font-normal">السعر</th>
                                  <th className="text-start py-1 pe-3 font-normal">تكلفة الجملة</th>
                                  <th className="text-start py-1 pe-3 font-normal">تكلفة التوصيل</th>
                                  <th className="text-start py-1 pe-3 font-normal">صافي الربح</th>
                                  <th className="text-start py-1 pe-3 font-normal">المندوب</th>
                                  <th className="text-start py-1 font-normal">العمولة</th>
                                </tr>
                              </thead>
                              <tbody>
                                {share.orders.map(o => (
                                  <tr key={o.id} className="border-b border-white/5">
                                    <td className="py-1.5 pe-3 text-white/70">{o.productType}</td>
                                    <td className="py-1.5 pe-3 text-white/70">{o.quantity}</td>
                                    <td className="py-1.5 pe-3 text-white/70">{o.totalPrice.toLocaleString()}</td>
                                    <td className="py-1.5 pe-3 text-white/70">{o.wholesaleCostAtOrderTime.toLocaleString()}</td>
                                    <td className="py-1.5 pe-3 text-white/70">{o.deliveryCostAtOrderTime.toLocaleString()}</td>
                                    <td className="py-1.5 pe-3 text-white/70">{o.grossProfitAtOrderTime.toLocaleString()}</td>
                                    <td className="py-1.5 pe-3 text-white/70">{o.merchantName}</td>
                                    <td className="py-1.5 text-white/70">{o.commissionAtOrderTime.toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <p className="text-xs text-white/30">
                            {share.orderCount} طلب — {share.distinctMerchantCount} مندوب — إجمالي عمولاتهم {share.totalCommission.toLocaleString()} د.ع
                          </p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <p className="text-sm text-white/30">لا توجد حصص غير مدفوعة حالياً</p>
              )}
            </div>
          </section>
        )}

        {/* Manager summary */}
        {role === "manager" && (
          <section>
            <h2 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
              <TrendingUp className="w-5 h-5 text-purple-300" />
              ملخص الفريق بالكامل
            </h2>
            {subordinatesSummary.isLoading ? (
              <p className="text-center text-white/40 py-8">جاري التحميل...</p>
            ) : subordinatesSummary.data ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-2xl bg-white/[0.03] border border-purple-500/20 p-5 text-center">
                  <p className="text-2xl font-black text-purple-300">{subordinatesSummary.data.subordinateCount}</p>
                  <p className="text-xs text-white/40 mt-1">أفراد الفريق</p>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-purple-500/20 p-5 text-center">
                  <p className="text-2xl font-black text-purple-300">{subordinatesSummary.data.settlementCount}</p>
                  <p className="text-xs text-white/40 mt-1">عدد التسويات</p>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-purple-500/20 p-5 text-center">
                  <p className="text-2xl font-black text-purple-300">{formatMoney(subordinatesSummary.data.totalNetProfit)}</p>
                  <p className="text-xs text-white/40 mt-1">إجمالي صافي الربح (د.ع)</p>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-emerald-500/30 p-5 text-center">
                  <p className="text-2xl font-black text-emerald-300">{formatMoney(subordinatesSummary.data.totalManagerOverrideShare)}</p>
                  <p className="text-xs text-white/40 mt-1">حصتك من الفريق (د.ع)</p>
                </div>
              </div>
            ) : (
              <p className="text-center text-white/40 py-8">لا توجد بيانات بعد</p>
            )}
          </section>
        )}

        {/* Supervisor/leader direct subordinates */}
        {(role === "supervisor" || role === "leader") && (
          <section>
            <h2 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
              <Layers className="w-5 h-5 text-purple-300" />
              فريقي المباشر
            </h2>
            {mySubordinates.isLoading ? (
              <p className="text-center text-white/40 py-8">جاري التحميل...</p>
            ) : mySubordinates.data && mySubordinates.data.length > 0 ? (
              <div className="space-y-6">
                {mySubordinates.data.map(({ merchant, settlements }) => (
                  <div key={merchant.id} className="rounded-2xl border border-white/10 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-semibold text-white">{merchant.name}</span>
                      <RoleBadge role={merchant.role} />
                    </div>
                    {settlements.length > 0 ? (
                      <div className="space-y-3">
                        {settlements.map((s: any) => <SettlementRow key={s.id} settlement={s} viewerRole={role} />)}
                      </div>
                    ) : (
                      <p className="text-sm text-white/30">لا توجد تسويات بعد</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Layers className="w-12 h-12 mx-auto text-white/20 mb-3" />
                <p className="text-white/40">لا يوجد أعضاء في فريقك بعد</p>
              </div>
            )}
          </section>
        )}

        {/* Own settlements - hidden entirely for sales_rep (see routers.ts
            mySettlements FORBIDDEN gate - this is their own commission from
            being swept into a hierarchical settlement, but sales_rep is
            deliberately excluded from seeing it via this page). */}
        {role !== "sales_rep" && (
          <section>
            <h2 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
              <TrendingUp className="w-5 h-5 text-purple-300" />
              تسوياتي
            </h2>
            {mySettlements.isLoading ? (
              <p className="text-center text-white/40 py-8">جاري التحميل...</p>
            ) : mySettlements.data && mySettlements.data.length > 0 ? (
              <div className="space-y-3">
                {mySettlements.data.map((s: any) => <SettlementRow key={s.id} settlement={s} viewerRole={role} />)}
              </div>
            ) : (
              <div className="text-center py-12">
                <TrendingUp className="w-12 h-12 mx-auto text-white/20 mb-3" />
                <p className="text-white/40">لا توجد تسويات أرباح بعد</p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

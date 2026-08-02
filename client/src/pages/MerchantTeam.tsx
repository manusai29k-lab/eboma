import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/RoleBadge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageLightbox } from "@/components/ImageLightbox";
import { ROLE_CONFIG } from "@/lib/merchantRoles";
import { useLocation } from "wouter";
import { ArrowRight, Users, TrendingUp, Layers, Wallet, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import type { TranslationKeys } from "@/i18n";

const STATUS_BADGE_CLASSNAME: Record<string, string> = {
  draft: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  confirmed: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  preparing: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  shipped: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  delivered: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-red-500/20 text-red-300 border-red-500/30",
  returned: "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

function formatMoney(value: string | number | null) {
  if (value === null || value === undefined) return null;
  return Number(value).toLocaleString();
}

function formatPeriod(start: string | Date, end: string | Date) {
  return `${new Date(start).toLocaleDateString("ar-IQ")} - ${new Date(end).toLocaleDateString("ar-IQ")}`;
}

// Renders a branch's role breakdown bottom-up (sales_rep, then supervisor,
// then leader) e.g. "3 مندوبين، مشرف واحد" - dynamic per the actual roles
// present in that branch, since a leader's branch can mix supervisors and
// sales_reps while a manager's can mix all three. roleCountWords is passed
// in (rather than read from a module constant) since this is a plain
// function, not a component, and can't call useLanguage() itself.
function formatRoleCounts(roleCounts: Partial<Record<string, number>>, roleCountWords: TranslationKeys["merchantTeam"]["roleCountWords"]): string {
  const order = ["sales_rep", "supervisor", "leader"] as const;
  return order
    .filter(role => (roleCounts[role] ?? 0) > 0)
    .map(role => {
      const n = roleCounts[role]!;
      const [singular, dual, plural] = roleCountWords[role];
      if (n === 1) return singular;
      if (n === 2) return dual;
      return `${n} ${plural}`;
    })
    .join("، ");
}

function SettlementRow({ settlement, viewerRole }: { settlement: any; viewerRole?: string }) {
  const { t } = useLanguage();
  const statusLabel = t.merchantTeam.settlementStatus[settlement.status as keyof typeof t.merchantTeam.settlementStatus] ?? t.merchantTeam.settlementStatus.draft;
  const statusClassName = STATUS_BADGE_CLASSNAME[settlement.status] ?? STATUS_BADGE_CLASSNAME.draft;
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
            <Badge className={statusClassName}>{statusLabel}</Badge>
            <span className="text-xs text-white/30">{formatPeriod(settlement.periodStart, settlement.periodEnd)}</span>
          </div>
          {(grossProfit !== null || promotionCost !== null) && (
            <p className="text-sm text-white/50">
              {grossProfit !== null && <>{t.merchantTeam.grossProfitLabel}<span className="text-white/70">{grossProfit} {t.common.currency}</span></>}
              {promotionCost !== null && <span className="ms-3">{t.merchantTeam.promotionCostLabel}<span className="text-white/70">{promotionCost} {t.common.currency}</span></span>}
            </p>
          )}
          {managerOverrideShare !== null && (
            <p className="text-sm text-white/50">{t.merchantTeam.managerShareLabel}<span className="text-white/70">{managerOverrideShare} {t.common.currency}</span></p>
          )}
        </div>
        <div className="text-start shrink-0">
          <p className="text-lg font-bold text-purple-300">{formatMoney(settlement.merchantShare)} {t.common.currency}</p>
          {showNetProfit && (
            <p className="text-xs text-white/30 mt-1">{t.merchantTeam.netProfitLabel}{formatMoney(settlement.netProfit)} {t.common.currency}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MerchantTeam() {
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

  const liveTeamOrders = trpc.physicalOrders.liveTeamOrders.useQuery(undefined, {
    enabled: enabled && role !== "sales_rep",
    refetchOnWindowFocus: false,
    refetchInterval: 15000,
  });

  const myShareDetails = trpc.profitSettlements.myShareDetails.useQuery({ filter: "unpaid" }, {
    enabled: enabled && hasOverride,
    refetchOnWindowFocus: false,
  });

  const [selectedDescendantId, setSelectedDescendantId] = useState<string>("");

  const myDescendants = trpc.profitSettlements.myDescendants.useQuery(undefined, {
    enabled: enabled && role !== "sales_rep",
    refetchOnWindowFocus: false,
  });

  const subordinateShareDetails = trpc.profitSettlements.subordinateShareDetails.useQuery(
    selectedDescendantId ? { targetMerchantId: parseInt(selectedDescendantId) } : ({} as any),
    { enabled: enabled && role !== "sales_rep" && selectedDescendantId !== "", refetchOnWindowFocus: false }
  );

  if (merchantMe.isLoading || !merchantMe.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060814]">
        <p className="text-white/40">{t.common.loading}</p>
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
              <h1 className="text-lg font-bold text-white">{t.merchantTeam.pageTitle}</h1>
              {role && <div className="mt-0.5"><RoleBadge role={role} /></div>}
            </div>
          </div>
          <LanguageSwitcher className="ms-auto" />
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
              {t.merchantTeam.currentBalanceTitle}
            </h2>

            <div className="rounded-2xl bg-white/[0.03] border border-emerald-500/20 p-6 mb-6 text-center">
              <p className="text-3xl font-black text-emerald-300">
                {myBalance.isLoading ? "..." : `${formatMoney(myBalance.data ?? 0)} ${t.common.currency}`}
              </p>
              <p className="text-xs text-white/40 mt-1">{t.merchantTeam.outstandingBalance}</p>
            </div>

            <div className="space-y-3 mb-6">
              <h3 className="text-sm font-semibold text-white/50">{t.merchantTeam.payoutHistory}</h3>
              {myPayouts.isLoading ? (
                <p className="text-center text-white/40 py-4">{t.common.loading}</p>
              ) : myPayouts.data && myPayouts.data.length > 0 ? (
                <div className="space-y-3">
                  {myPayouts.data.map(p => (
                    <div key={p.id} className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <p className="text-sm text-white/70">{new Date(p.createdAt).toLocaleDateString("ar-IQ")}</p>
                        {p.note && <p className="text-xs text-white/30 mt-1">{p.note}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        {p.proofUrl && <ImageLightbox src={p.proofUrl} alt={t.merchantTeam.paymentProofAlt} className="max-h-12 rounded-lg border border-white/10" />}
                        {/* promotionProofUrl exists only on the unmasked
                            branch (canViewCosts=true) - checked via 'in'. */}
                        {'promotionProofUrl' in p && p.promotionProofUrl && (
                          <ImageLightbox src={p.promotionProofUrl} alt={t.merchantTeam.promotionProofAlt} className="max-h-12 rounded-lg border border-white/10" />
                        )}
                        <p className="text-lg font-bold text-emerald-300">{formatMoney(p.amount)} {t.common.currency}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/30">{t.merchantTeam.noPreviousPayouts}</p>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white/50">{t.merchantTeam.unpaidSharesDetail}</h3>
              {myShareDetails.isLoading ? (
                <p className="text-center text-white/40 py-4">{t.common.loading}</p>
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
                          {/* shareAmount exists only on the unmasked branch
                              (canViewCosts=true) - checked via 'in', not
                              assumed, since MaskedMerchantShareDetail omits it
                              entirely. */}
                          {'shareAmount' in share && (
                            <span className="text-emerald-300 font-bold shrink-0">{formatMoney(share.shareAmount)} {t.common.currency}</span>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pb-2">
                          {'shareAmount' in share ? (
                            <>
                              <p className="text-sm text-white/50">
                                {t.merchantTeam.netProfitLabel}<span className="text-white/70">{formatMoney(share.settlement.netProfit)} {t.common.currency}</span>
                                <span className="ms-3">{t.merchantTeam.promotionCostLabel2}<span className="text-white/70">{formatMoney(share.settlement.promotionCost)} {t.common.currency}</span></span>
                              </p>
                              {share.settlement.promotionProofUrl && (
                                <ImageLightbox src={share.settlement.promotionProofUrl} alt={t.merchantTeam.promotionProofAlt} className="max-h-24 rounded-lg border border-white/10" />
                              )}
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-white/40 border-b border-white/10">
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.tableHeaders.product}</th>
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.tableHeaders.quantity}</th>
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.tableHeaders.price}</th>
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.tableHeaders.wholesaleCost}</th>
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.tableHeaders.deliveryCost}</th>
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.tableHeaders.netProfit}</th>
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.tableHeaders.salesRep}</th>
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.tableHeaders.commission}</th>
                                      <th className="text-start py-1 font-normal">{t.merchantTeam.tableHeaders.date}</th>
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
                                        <td className="py-1.5 pe-3 text-white/70">{o.commissionAtOrderTime.toLocaleString()}</td>
                                        <td className="py-1.5 text-white/50">{new Date(o.createdAt).toLocaleDateString("ar-IQ")}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <p className="text-xs text-white/30">
                                {t.merchantTeam.commissionSummary(share.orderCount, share.distinctMerchantCount, share.totalCommission.toLocaleString(), t.common.currency)}
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-white/40 border-b border-white/10">
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.maskedTableHeaders.orderId}</th>
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.maskedTableHeaders.product}</th>
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.maskedTableHeaders.quantity}</th>
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.maskedTableHeaders.salesRep}</th>
                                      <th className="text-start py-1 font-normal">{t.merchantTeam.maskedTableHeaders.date}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {share.orders.map(o => (
                                      <tr key={o.id} className="border-b border-white/5">
                                        <td className="py-1.5 pe-3 text-white/70">#{o.id}</td>
                                        <td className="py-1.5 pe-3 text-white/70">{o.productType}</td>
                                        <td className="py-1.5 pe-3 text-white/70">{o.quantity}</td>
                                        <td className="py-1.5 pe-3 text-white/70">{o.merchantName}</td>
                                        <td className="py-1.5 text-white/50">{new Date(o.createdAt).toLocaleDateString("ar-IQ")}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <p className="text-xs text-white/30">{t.merchantTeam.orderMerchantSummary(share.orderCount, share.distinctMerchantCount)}</p>
                            </>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <p className="text-sm text-white/30">{t.merchantTeam.noUnpaidShares}</p>
              )}
            </div>
          </section>
        )}

        {/* Manager summary */}
        {role === "manager" && (
          <section>
            <h2 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
              <TrendingUp className="w-5 h-5 text-purple-300" />
              {t.merchantTeam.fullTeamSummary}
            </h2>
            {subordinatesSummary.isLoading ? (
              <p className="text-center text-white/40 py-8">{t.common.loading}</p>
            ) : subordinatesSummary.data ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-2xl bg-white/[0.03] border border-purple-500/20 p-5 text-center">
                  <p className="text-2xl font-black text-purple-300">{subordinatesSummary.data.subordinateCount}</p>
                  <p className="text-xs text-white/40 mt-1">{t.merchantTeam.teamMembers}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-purple-500/20 p-5 text-center">
                  <p className="text-2xl font-black text-purple-300">{subordinatesSummary.data.settlementCount}</p>
                  <p className="text-xs text-white/40 mt-1">{t.merchantTeam.settlementCount}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-purple-500/20 p-5 text-center">
                  <p className="text-2xl font-black text-purple-300">{formatMoney(subordinatesSummary.data.totalNetProfit)}</p>
                  <p className="text-xs text-white/40 mt-1">{t.merchantTeam.totalNetProfitLabel(t.common.currency)}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-emerald-500/30 p-5 text-center">
                  <p className="text-2xl font-black text-emerald-300">{formatMoney(subordinatesSummary.data.totalManagerOverrideShare)}</p>
                  <p className="text-xs text-white/40 mt-1">{t.merchantTeam.yourTeamShareLabel(t.common.currency)}</p>
                </div>
              </div>
            ) : (
              <p className="text-center text-white/40 py-8">{t.merchantTeam.noDataYet}</p>
            )}
          </section>
        )}

        {/* Supervisor/leader direct subordinates */}
        {(role === "supervisor" || role === "leader") && (
          <section>
            <h2 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
              <Layers className="w-5 h-5 text-purple-300" />
              {t.merchantTeam.directTeam}
            </h2>
            {mySubordinates.isLoading ? (
              <p className="text-center text-white/40 py-8">{t.common.loading}</p>
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
                      <p className="text-sm text-white/30">{t.merchantTeam.noSettlementsYet}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Layers className="w-12 h-12 mx-auto text-white/20 mb-3" />
                <p className="text-white/40">{t.merchantTeam.noTeamMembers}</p>
              </div>
            )}
          </section>
        )}

        {/* Full settlement detail for ANY descendant at any depth - unlike
            "فريقي المباشر" above (direct-only, masked to period/status),
            this shows the same full grossProfit/promotionCost/proof/
            per-order breakdown as "أرباحي" above, but for a chosen
            descendant rather than the viewer's own shares. Server-side
            requires the viewer to actually be an ancestor of the chosen
            descendant (routers.ts subordinateShareDetails / db.ts
            isAncestorOf) - never just a UI restriction. Masked by the
            VIEWER's own canViewCosts (routers.ts), same as "أرباحي". */}
        {role !== "sales_rep" && (
          <section>
            <h2 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
              <TrendingUp className="w-5 h-5 text-purple-300" />
              {t.merchantTeam.teamSettlementDetails}
            </h2>
            <p className="text-xs text-white/30 mb-3">{t.merchantTeam.descendantPickerHint}</p>

            <Select value={selectedDescendantId} onValueChange={setSelectedDescendantId}>
              <SelectTrigger className="mb-4"><SelectValue placeholder={t.merchantTeam.descendantPlaceholder} /></SelectTrigger>
              <SelectContent>
                {myDescendants.data?.map(m => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.name} — {ROLE_CONFIG[m.role].label}</SelectItem>
                ))}
                {myDescendants.data?.length === 0 && (
                  <div className="px-2 py-4 text-sm text-white/40 text-center">{t.merchantTeam.noDescendants}</div>
                )}
              </SelectContent>
            </Select>

            {selectedDescendantId !== "" && (
              subordinateShareDetails.isLoading ? (
                <p className="text-center text-white/40 py-4">{t.common.loading}</p>
              ) : subordinateShareDetails.data && subordinateShareDetails.data.length > 0 ? (
                <Accordion type="single" collapsible className="space-y-2">
                  {subordinateShareDetails.data.map(detail => (
                    <AccordionItem
                      key={detail.settlement.id}
                      value={String(detail.settlement.id)}
                      className="rounded-xl bg-white/[0.03] border border-white/10 px-4"
                    >
                      <AccordionTrigger className="text-white hover:no-underline">
                        <span className="text-sm text-white/70">
                          {formatPeriod(detail.settlement.periodStart, detail.settlement.periodEnd)} — {detail.settlement.sourceMerchantName}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pb-2">
                          {/* totalCommission exists only on the unmasked
                              branch (canViewCosts=true) - checked via 'in',
                              same convention as "أرباحي" above. */}
                          {'totalCommission' in detail ? (
                            <>
                              <p className="text-sm text-white/50">
                                {t.merchantTeam.netProfitLabel}<span className="text-white/70">{formatMoney(detail.settlement.netProfit)} {t.common.currency}</span>
                                <span className="ms-3">{t.merchantTeam.promotionCostLabel2}<span className="text-white/70">{formatMoney(detail.settlement.promotionCost)} {t.common.currency}</span></span>
                              </p>
                              {detail.settlement.promotionProofUrl && (
                                <ImageLightbox src={detail.settlement.promotionProofUrl} alt={t.merchantTeam.promotionProofAlt} className="max-h-24 rounded-lg border border-white/10" />
                              )}
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-white/40 border-b border-white/10">
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.tableHeaders.product}</th>
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.tableHeaders.quantity}</th>
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.tableHeaders.price}</th>
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.tableHeaders.wholesaleCost}</th>
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.tableHeaders.deliveryCost}</th>
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.tableHeaders.netProfit}</th>
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.tableHeaders.salesRep}</th>
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.tableHeaders.commission}</th>
                                      <th className="text-start py-1 font-normal">{t.merchantTeam.tableHeaders.date}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detail.orders.map(o => (
                                      <tr key={o.id} className="border-b border-white/5">
                                        <td className="py-1.5 pe-3 text-white/70">{o.productType}</td>
                                        <td className="py-1.5 pe-3 text-white/70">{o.quantity}</td>
                                        <td className="py-1.5 pe-3 text-white/70">{o.totalPrice.toLocaleString()}</td>
                                        <td className="py-1.5 pe-3 text-white/70">{o.wholesaleCostAtOrderTime.toLocaleString()}</td>
                                        <td className="py-1.5 pe-3 text-white/70">{o.deliveryCostAtOrderTime.toLocaleString()}</td>
                                        <td className="py-1.5 pe-3 text-white/70">{o.grossProfitAtOrderTime.toLocaleString()}</td>
                                        <td className="py-1.5 pe-3 text-white/70">{o.merchantName}</td>
                                        <td className="py-1.5 pe-3 text-white/70">{o.commissionAtOrderTime.toLocaleString()}</td>
                                        <td className="py-1.5 text-white/50">{new Date(o.createdAt).toLocaleDateString("ar-IQ")}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <p className="text-xs text-white/30">
                                {t.merchantTeam.commissionSummary(detail.orderCount, detail.distinctMerchantCount, detail.totalCommission.toLocaleString(), t.common.currency)}
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-white/40 border-b border-white/10">
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.maskedTableHeaders.orderId}</th>
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.maskedTableHeaders.product}</th>
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.maskedTableHeaders.quantity}</th>
                                      <th className="text-start py-1 pe-3 font-normal">{t.merchantTeam.maskedTableHeaders.salesRep}</th>
                                      <th className="text-start py-1 font-normal">{t.merchantTeam.maskedTableHeaders.date}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detail.orders.map(o => (
                                      <tr key={o.id} className="border-b border-white/5">
                                        <td className="py-1.5 pe-3 text-white/70">#{o.id}</td>
                                        <td className="py-1.5 pe-3 text-white/70">{o.productType}</td>
                                        <td className="py-1.5 pe-3 text-white/70">{o.quantity}</td>
                                        <td className="py-1.5 pe-3 text-white/70">{o.merchantName}</td>
                                        <td className="py-1.5 text-white/50">{new Date(o.createdAt).toLocaleDateString("ar-IQ")}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <p className="text-xs text-white/30">{t.merchantTeam.orderMerchantSummary(detail.orderCount, detail.distinctMerchantCount)}</p>
                            </>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <p className="text-sm text-white/30 py-4">{t.merchantTeam.noConfirmedSettlementsForDescendant}</p>
              )
            )}
          </section>
        )}

        {/* Live team orders - supervisor/leader/manager only, ENTIRE
            subordinate tree (any depth), grouped by branch: one accordion
            item per direct subordinate, carrying every order from them and
            everyone under them (see routers.ts physicalOrders.liveTeamOrders
            / db.getLiveTeamOrdersByBranch). Independent of profitSettlements
            - never waits for a settlement sweep. Cost/profit fields appear
            only when the viewer's own canViewCosts is true. */}
        {role !== "sales_rep" && (
          <section>
            <h2 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
              <Radio className="w-5 h-5 text-purple-300" />
              {t.merchantTeam.liveTeamOrders}
            </h2>
            {liveTeamOrders.isLoading ? (
              <p className="text-center text-white/40 py-8">{t.common.loading}</p>
            ) : liveTeamOrders.data && liveTeamOrders.data.length > 0 ? (
              <Accordion type="single" collapsible className="space-y-2">
                {liveTeamOrders.data.map((branch: any) => (
                  <AccordionItem
                    key={branch.merchant.id}
                    value={String(branch.merchant.id)}
                    className="rounded-xl bg-white/[0.03] border border-white/10 px-4"
                  >
                    <AccordionTrigger className="text-white hover:no-underline">
                      <div className="flex items-center justify-between w-full pe-2 gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{branch.merchant.name}</span>
                          <RoleBadge role={branch.merchant.role} />
                        </div>
                        <span className="text-xs text-white/40 shrink-0">
                          {formatRoleCounts(branch.roleCounts, t.merchantTeam.roleCountWords)}
                          {formatRoleCounts(branch.roleCounts, t.merchantTeam.roleCountWords) && " — "}
                          {t.merchantTeam.ordersCount(branch.orders.length)}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {branch.orders.length > 0 ? (
                        <div className="space-y-3 pb-2">
                          {branch.orders.map((order: any) => (
                            <div key={order.id} className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 backdrop-blur-sm">
                              <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-white">#{order.id}</span>
                                    <Badge className={`${ORDER_STATUS_COLORS[order.status] || "bg-white/10 text-white/60"} border`}>
                                      {t.common.status[order.status as keyof typeof t.common.status] || order.status}
                                    </Badge>
                                    <span className="text-xs text-white/30">{order.merchantName}</span>
                                  </div>
                                  <p className="text-sm text-white/60"><span className="text-white/40">{t.merchantTeam.productLabel}</span> {order.productType} × {order.quantity}</p>
                                  <p className="text-sm text-white/60"><span className="text-white/40">{t.merchantTeam.addressLabel}</span> {order.province} - {order.district}</p>
                                  {order.grossProfitAtOrderTime !== undefined && (
                                    <p className="text-sm text-white/60">
                                      <span className="text-white/40">{t.merchantTeam.wholesaleCostLabel}</span> {formatMoney(order.wholesaleCostAtOrderTime)} {t.common.currency}
                                      <span className="ms-3 text-white/40">{t.merchantTeam.deliveryCostLabel}</span> {formatMoney(order.deliveryCostAtOrderTime)} {t.common.currency}
                                      <span className="ms-3 text-white/40">{t.merchantTeam.netProfitColonLabel}</span> {formatMoney(order.grossProfitAtOrderTime)} {t.common.currency}
                                    </p>
                                  )}
                                </div>
                                <div className="text-start shrink-0">
                                  <p className="text-lg font-bold text-purple-300">{Number(order.totalPrice).toLocaleString()} {t.common.currency}</p>
                                  <p className="text-xs text-white/30 mt-1">{new Date(order.createdAt).toLocaleDateString("ar-IQ")}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-white/30 pb-2">{t.merchantTeam.noOrdersForBranch}</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="text-center py-12">
                <Radio className="w-12 h-12 mx-auto text-white/20 mb-3" />
                <p className="text-white/40">{t.merchantTeam.noTeamMembers}</p>
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
              {t.merchantTeam.mySettlements}
            </h2>
            {mySettlements.isLoading ? (
              <p className="text-center text-white/40 py-8">{t.common.loading}</p>
            ) : mySettlements.data && mySettlements.data.length > 0 ? (
              <div className="space-y-3">
                {mySettlements.data.map((s: any) => <SettlementRow key={s.id} settlement={s} viewerRole={role} />)}
              </div>
            ) : (
              <div className="text-center py-12">
                <TrendingUp className="w-12 h-12 mx-auto text-white/20 mb-3" />
                <p className="text-white/40">{t.merchantTeam.noProfitSettlements}</p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Percent, Eye, CheckCircle2, ImagePlus, AlertTriangle, Wallet, Users } from "lucide-react";
import { ROLE_CONFIG } from "@/lib/merchantRoles";
import { RoleBadge } from "@/components/RoleBadge";
import { ImageLightbox } from "@/components/ImageLightbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState, useMemo, useRef, Fragment } from "react";

const previewButtonIdleLabel = "معاينة";
const previewButtonLoadingLabel = "جاري الحساب...";
const confirmButtonIdleLabel = "تأكيد التسوية";
const confirmButtonLoadingLabel = "جاري التسوية...";

export default function AdminProfitSettlements() {
  // "single" = the original one-merchant flow. "group" = a chosen
  // supervisor/leader plus a checked subset of their DIRECT subordinates
  // (one campaign/promotion shared by just those subordinates).
  const [mode, setMode] = useState<"single" | "group">("single");
  const [merchantId, setMerchantId] = useState<string>("");
  const [groupHeadId, setGroupHeadId] = useState<string>("");
  const [selectedSubIds, setSelectedSubIds] = useState<number[]>([]);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [productId, setProductId] = useState<string>(""); // "" = كل المنتجات
  const [promotionCost, setPromotionCost] = useState<string>("0");
  const [promotionProofPreview, setPromotionProofPreview] = useState<string | null>(null);
  const [promotionProofName, setPromotionProofName] = useState<string | undefined>(undefined);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPromotionProofName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setPromotionProofPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const merchants = trpc.profitSettlements.unsettledMerchants.useQuery(undefined, { refetchOnWindowFocus: false });

  // Team-settlement mode: pick a supervisor/leader (groupHeadId), then their
  // DIRECT subordinates only (one level down - never the whole subtree, see
  // server/routers.ts directSubordinates) to check off.
  const groupHeads = trpc.profitSettlements.groupHeads.useQuery(undefined, {
    enabled: mode === "group",
    refetchOnWindowFocus: false,
  });
  const directSubordinates = trpc.profitSettlements.directSubordinates.useQuery(
    groupHeadId ? { parentMerchantId: parseInt(groupHeadId) } : ({} as any),
    { enabled: mode === "group" && groupHeadId !== "", refetchOnWindowFocus: false }
  );

  const period = useMemo(() => {
    if (!startDate || !endDate) return null;
    return {
      periodStart: new Date(startDate),
      periodEnd: new Date(endDate + "T23:59:59"),
    };
  }, [startDate, endDate]);

  const merchantIds = useMemo(() => {
    if (mode === "single") return merchantId ? [parseInt(merchantId)] : [];
    return selectedSubIds;
  }, [mode, merchantId, selectedSubIds]);

  const canQuery = merchantIds.length > 0 && period !== null;
  const selectedProductId = productId ? parseInt(productId) : undefined;

  const orders = trpc.profitSettlements.unsettledOrders.useQuery(
    canQuery ? { merchantIds, ...period!, productId: selectedProductId } : ({} as any),
    { enabled: canQuery, refetchOnWindowFocus: false }
  );

  // Unfiltered fetch (no productId) purely to populate the "تصفية حسب منتج"
  // options list - kept independent of the filtered `orders` query above so
  // switching between products doesn't require resetting the picker first.
  const allOrdersForProductOptions = trpc.profitSettlements.unsettledOrders.useQuery(
    canQuery ? { merchantIds, ...period! } : ({} as any),
    { enabled: canQuery, refetchOnWindowFocus: false }
  );

  const productOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const o of allOrdersForProductOptions.data ?? []) {
      if (o.productId != null && !map.has(o.productId)) map.set(o.productId, o.productType);
    }
    return Array.from(map.entries(), ([id, label]) => ({ id, label }));
  }, [allOrdersForProductOptions.data]);

  const preview = trpc.profitSettlements.preview.useQuery(
    canQuery ? { merchantIds, ...period!, promotionCost: parseFloat(promotionCost) || 0, productId: selectedProductId } : ({} as any),
    { enabled: false }
  );

  const utils = trpc.useUtils();
  const createMutation = trpc.profitSettlements.create.useMutation({
    onSuccess: () => {
      toast.success("تمت تسوية الأرباح الهرمية بنجاح");
      setShowPreview(false);
      setMerchantId("");
      setGroupHeadId("");
      setSelectedSubIds([]);
      setStartDate("");
      setEndDate("");
      setProductId("");
      setPromotionCost("0");
      setPromotionProofPreview(null);
      setPromotionProofName(undefined);
      utils.profitSettlements.unsettledMerchants.invalidate();
      utils.profitSettlements.unsettledOrders.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشلت عملية التسوية");
    },
  });

  const handlePreview = async () => {
    if (!canQuery) {
      toast.error(mode === "single" ? "يرجى اختيار التاجر والفترة أولاً" : "يرجى اختيار المشرف/القائد، مندوب واحد على الأقل، والفترة أولاً");
      return;
    }
    const result = await preview.refetch();
    if (result.data) setShowPreview(true);
  };

  const handleConfirm = () => {
    if (!canQuery) return;
    createMutation.mutate({
      merchantIds,
      ...period!,
      productId: selectedProductId,
      promotionCost: parseFloat(promotionCost) || 0,
      promotionProofBase64: promotionProofName ? (promotionProofPreview ?? undefined) : undefined,
      promotionProofName,
    });
  };

  const handleModeChange = (m: "single" | "group") => {
    setMode(m);
    setMerchantId("");
    setGroupHeadId("");
    setSelectedSubIds([]);
    setProductId("");
    setShowPreview(false);
  };

  const toggleSubordinate = (id: number) => {
    setSelectedSubIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    setProductId("");
    setShowPreview(false);
  };

  const orderRows = orders.data ?? [];
  const totalGrossProfit = orderRows.reduce((acc, o) => acc + o.grossProfitAtOrderTime, 0);
  const breakdown = preview.data;
  const promotionCostValue = parseFloat(promotionCost) || 0;

  // Group mode only: which checked subordinates have zero eligible orders in
  // the CURRENT period/product filter (orders.data already reflects both) -
  // they'll still get swept as "no contribution" and excluded from
  // profitSettlementMerchants server-side (see db.ts), but the admin should
  // know before confirming.
  const merchantsWithNoOrders = useMemo(() => {
    if (mode !== "group" || !orders.data) return [];
    const contributingIds = new Set(orders.data.map(o => o.merchantId));
    return selectedSubIds
      .filter(id => !contributingIds.has(id))
      .map(id => directSubordinates.data?.find(s => s.id === id)?.name ?? `#${id}`);
  }, [mode, orders.data, selectedSubIds, directSubordinates.data]);

  // Balances tab - every merchant currently holding (or having held) an
  // ancestor override share, with a one-click payout that sweeps their
  // entire current outstanding balance (see db.settleMerchantPayout).
  const balances = trpc.profitSettlements.balances.useQuery(undefined, { refetchOnWindowFocus: false });

  // Payouts history tab - every payout ever made across all merchants.
  const allPayouts = trpc.profitSettlements.allPayouts.useQuery(undefined, { refetchOnWindowFocus: false });

  const [showSettleDialog, setShowSettleDialog] = useState(false);
  const [settleMerchantId, setSettleMerchantId] = useState<number | null>(null);
  const [settleMerchantName, setSettleMerchantName] = useState("");
  const [settleAmount, setSettleAmount] = useState(0);
  const [settleNote, setSettleNote] = useState("");
  const [settleProofPreview, setSettleProofPreview] = useState<string | null>(null);
  const [settleProofName, setSettleProofName] = useState<string | undefined>(undefined);
  const settleFileInputRef = useRef<HTMLInputElement>(null);

  const settlePayoutMutation = trpc.profitSettlements.settlePayout.useMutation({
    onSuccess: () => {
      toast.success("تمت تسوية الرصيد بنجاح");
      setShowSettleDialog(false);
      setSettleMerchantId(null);
      setSettleNote("");
      setSettleProofPreview(null);
      setSettleProofName(undefined);
      utils.profitSettlements.balances.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشلت عملية تسوية الرصيد");
    },
  });

  const openSettleDialog = (id: number, name: string, amount: number) => {
    setSettleMerchantId(id);
    setSettleMerchantName(name);
    setSettleAmount(amount);
    setSettleNote("");
    setSettleProofPreview(null);
    setSettleProofName(undefined);
    setShowSettleDialog(true);
  };

  const handleSettleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSettleProofName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setSettleProofPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSettlePayout = () => {
    if (!settleMerchantId) return;
    settlePayoutMutation.mutate({
      merchantId: settleMerchantId,
      note: settleNote || undefined,
      proofBase64: settleProofName ? (settleProofPreview ?? undefined) : undefined,
      proofName: settleProofName,
    });
  };

  // Row-expand state - which merchant's individual unpaid shares are shown.
  const [expandedMerchantId, setExpandedMerchantId] = useState<number | null>(null);

  const merchantShareDetails = trpc.profitSettlements.merchantShareDetails.useQuery(
    expandedMerchantId !== null ? { merchantId: expandedMerchantId } : ({} as any),
    { enabled: expandedMerchantId !== null, refetchOnWindowFocus: false }
  );

  // Single-share payout dialog - fully independent of the bulk "تسوية الرصيد"
  // dialog/settlePayoutMutation above, which stay completely unchanged.
  const [showSettleShareDialog, setShowSettleShareDialog] = useState(false);
  const [settleShareId, setSettleShareId] = useState<number | null>(null);
  const [settleShareAmount, setSettleShareAmount] = useState(0);
  const [settleShareNote, setSettleShareNote] = useState("");
  const [settleShareProofPreview, setSettleShareProofPreview] = useState<string | null>(null);
  const [settleShareProofName, setSettleShareProofName] = useState<string | undefined>(undefined);
  const settleShareFileInputRef = useRef<HTMLInputElement>(null);

  const settleSingleShareMutation = trpc.profitSettlements.settleSingleShare.useMutation({
    onSuccess: () => {
      toast.success("تم دفع الحصة بنجاح");
      setShowSettleShareDialog(false);
      setSettleShareId(null);
      setSettleShareNote("");
      setSettleShareProofPreview(null);
      setSettleShareProofName(undefined);
      utils.profitSettlements.balances.invalidate();
      utils.profitSettlements.merchantShareDetails.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشلت عملية دفع الحصة");
    },
  });

  const openSettleShareDialog = (shareId: number, amount: number) => {
    setSettleShareId(shareId);
    setSettleShareAmount(amount);
    setSettleShareNote("");
    setSettleShareProofPreview(null);
    setSettleShareProofName(undefined);
    setShowSettleShareDialog(true);
  };

  const handleSettleShareFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSettleShareProofName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setSettleShareProofPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSettleSingleShare = () => {
    if (!settleShareId) return;
    settleSingleShareMutation.mutate({
      shareId: settleShareId,
      note: settleShareNote || undefined,
      proofBase64: settleShareProofName ? (settleShareProofPreview ?? undefined) : undefined,
      proofName: settleShareProofName,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">تسويات الأرباح الهرمية</h1>
        <p className="text-sm text-muted-foreground mt-1">
          توزيع صافي الربح على التاجر المباشر وكل الأسلاف صاحبي نسبة حصة إضافية بالهيكل التنظيمي
        </p>
      </div>

      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="create">
            <Percent className="w-4 h-4 ms-2" />
            إنشاء تسوية جديدة
          </TabsTrigger>
          <TabsTrigger value="balances">
            <Wallet className="w-4 h-4 ms-2" />
            أرصدة التجار
          </TabsTrigger>
          <TabsTrigger value="payouts">
            <CheckCircle2 className="w-4 h-4 ms-2" />
            سجل الدفعات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
      {/* Selection */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Percent className="w-5 h-5 text-primary" />
            اختيار التاجر والفترة
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mode toggle: "single" is the original one-merchant flow;
              "group" settles a supervisor/leader's chosen DIRECT
              subordinates (one level down only) together under one
              promotion cost - see server/db.ts assertSameDirectParent. */}
          <div className="flex gap-2 mb-4">
            <Button
              type="button"
              variant={mode === "single" ? "default" : "outline"}
              size="sm"
              onClick={() => handleModeChange("single")}
            >
              <Percent className="w-4 h-4 ms-2" />
              تسوية فرد واحد
            </Button>
            <Button
              type="button"
              variant={mode === "group" ? "default" : "outline"}
              size="sm"
              onClick={() => handleModeChange("group")}
            >
              <Users className="w-4 h-4 ms-2" />
              تسوية مجموعة (مشرف + مندوبين مباشرين)
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {mode === "single" ? (
              <div className="space-y-2">
                <Label>التاجر</Label>
                <Select value={merchantId} onValueChange={(v) => { setMerchantId(v); setProductId(""); setShowPreview(false); }}>
                  <SelectTrigger><SelectValue placeholder="اختر تاجراً" /></SelectTrigger>
                  <SelectContent>
                    {merchants.data?.map(m => (
                      <SelectItem key={m.id} value={String(m.id)}>{m.name} — {ROLE_CONFIG[m.role].label}</SelectItem>
                    ))}
                    {merchants.data?.length === 0 && (
                      <div className="px-2 py-4 text-sm text-muted-foreground text-center">لا يوجد تجار لديهم طلبات غير مسوّاة</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>المشرف/القائد</Label>
                <Select value={groupHeadId} onValueChange={(v) => { setGroupHeadId(v); setSelectedSubIds([]); setProductId(""); setShowPreview(false); }}>
                  <SelectTrigger><SelectValue placeholder="اختر مشرفاً أو قائداً" /></SelectTrigger>
                  <SelectContent>
                    {groupHeads.data?.map(m => (
                      <SelectItem key={m.id} value={String(m.id)}>{m.name} — {ROLE_CONFIG[m.role].label}</SelectItem>
                    ))}
                    {groupHeads.data?.length === 0 && (
                      <div className="px-2 py-4 text-sm text-muted-foreground text-center">لا يوجد مشرف/قائد لديه مندوبون مباشرون</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>من تاريخ</Label>
              <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setProductId(""); setShowPreview(false); }} />
            </div>
            <div className="space-y-2">
              <Label>إلى تاريخ</Label>
              <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setProductId(""); setShowPreview(false); }} />
            </div>
            {canQuery && (
              <div className="space-y-2">
                <Label>تصفية حسب منتج</Label>
                <Select value={productId || "all"} onValueChange={(v) => { setProductId(v === "all" ? "" : v); setShowPreview(false); }}>
                  <SelectTrigger><SelectValue placeholder="كل المنتجات" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المنتجات</SelectItem>
                    {productOptions.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2 border-2 border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg p-3">
              <Label>كلفة الترويج للفترة (د.ع)</Label>
              <Input
                type="number"
                value={promotionCost}
                onChange={(e) => { setPromotionCost(e.target.value); setShowPreview(false); }}
                dir="ltr"
                className="text-end"
              />
            </div>
          </div>

          {/* Group mode: checkbox list of the chosen head's DIRECT
              subordinates only (one level down, never deeper). */}
          {mode === "group" && groupHeadId !== "" && (
            <div className="mt-4 space-y-2">
              <Label>المندوبون المباشرون المشمولون بالتسوية</Label>
              {directSubordinates.isLoading ? (
                <p className="text-sm text-muted-foreground">جاري التحميل...</p>
              ) : directSubordinates.data && directSubordinates.data.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 border rounded-lg p-3">
                  {directSubordinates.data.map(sub => (
                    <label key={sub.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={selectedSubIds.includes(sub.id)}
                        onCheckedChange={() => toggleSubordinate(sub.id)}
                      />
                      <span>{sub.name}</span>
                      <RoleBadge role={sub.role} />
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">لا يوجد مندوبون مباشرون تحت هذا المشرف/القائد</p>
              )}
            </div>
          )}

          {mode === "group" && canQuery && merchantsWithNoOrders.length > 0 && (
            <div className="mt-4 rounded-lg border-2 border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-300 space-y-0.5">
                {merchantsWithNoOrders.map(name => (
                  <p key={name}>{name}: هذا التاجر لا يملك طلبات بهذه الفترة</p>
                ))}
              </div>
            </div>
          )}

          {/* Promotion proof image upload */}
          <div className="mt-4 space-y-2">
            <Label>صورة إثبات كلفة الترويج (اختياري)</Label>
            <div
              className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 transition-colors max-w-xs"
              onClick={() => fileInputRef.current?.click()}
            >
              {promotionProofPreview ? (
                <img src={promotionProofPreview} alt="معاينة إثبات الترويج" className="max-h-32 mx-auto rounded-lg" />
              ) : (
                <div className="py-3">
                  <ImagePlus className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                  <p className="text-sm text-muted-foreground">اضغط لرفع صورة إثبات</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Eligible orders breakdown */}
      {canQuery && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">الطلبات المؤهّلة ({orderRows.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {mode === "group" && <TableHead>التاجر</TableHead>}
                    <TableHead>المنتج</TableHead>
                    <TableHead>الكمية</TableHead>
                    <TableHead>سعر البيع</TableHead>
                    <TableHead>تكلفة الجملة</TableHead>
                    <TableHead>تكلفة التوصيل</TableHead>
                    <TableHead>صافي الربح</TableHead>
                    <TableHead>التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderRows.map(o => (
                    <TableRow key={o.id}>
                      {mode === "group" && <TableCell className="text-xs text-muted-foreground">{o.merchantName}</TableCell>}
                      <TableCell>{o.productType}</TableCell>
                      <TableCell>{o.quantity}</TableCell>
                      <TableCell>{o.totalPrice.toLocaleString()} د.ع</TableCell>
                      <TableCell>{o.wholesaleCostAtOrderTime.toLocaleString()} د.ع</TableCell>
                      <TableCell>{o.deliveryCostAtOrderTime.toLocaleString()} د.ع</TableCell>
                      <TableCell className="font-semibold text-emerald-600">{o.grossProfitAtOrderTime.toLocaleString()} د.ع</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("ar-IQ")}</TableCell>
                    </TableRow>
                  ))}
                  {orderRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={mode === "group" ? 8 : 7} className="text-center text-muted-foreground py-8">
                        لا توجد طلبات مُسلَّمة غير مسوّاة بهذه الفترة
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {orderRows.length > 0 && (
              <div className="flex justify-end p-4 border-t">
                <p className="text-sm font-semibold">
                  إجمالي صافي الربح (grossProfit): <span className="text-emerald-600">{totalGrossProfit.toLocaleString()} د.ع</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {showPreview && breakdown && (
        <Card className="shadow-sm border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              معاينة توزيع الحصص
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card><CardContent className="py-4 text-center"><p className="text-sm text-muted-foreground">صافي الربح</p><p className="text-xl font-bold">{breakdown.netProfit.toLocaleString()} د.ع</p></CardContent></Card>
              <Card><CardContent className="py-4 text-center"><p className="text-sm text-muted-foreground">حصة التاجر المباشر</p><p className="text-xl font-bold text-emerald-600">{breakdown.merchantShare.toLocaleString()} د.ع</p></CardContent></Card>
              <Card><CardContent className="py-4 text-center"><p className="text-sm text-muted-foreground">حصة الشركة</p><p className="text-xl font-bold text-amber-600">{breakdown.companyShare.toLocaleString()} د.ع</p></CardContent></Card>
            </div>

            {breakdown.ancestorShares.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الرتبة</TableHead>
                      <TableHead>النسبة</TableHead>
                      <TableHead>المبلغ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {breakdown.ancestorShares.map((a, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Badge variant="outline">{ROLE_CONFIG[a.role].label}</Badge>
                        </TableCell>
                        <TableCell>{a.overridePercentage}%</TableCell>
                        <TableCell className="font-semibold text-primary">{a.shareAmount.toLocaleString()} د.ع</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Read-only echo of the promotionCost value entered above, plus a
                non-blocking warning when it's still 0 - the admin easily
                misses the input in the selection card otherwise. */}
            <div className="space-y-3 pt-2 border-t">
              <p className="text-sm">
                كلفة الترويج المُدخلة: <span className="font-semibold">{promotionCostValue.toLocaleString()} د.ع</span>
              </p>
              {promotionCostValue === 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    تنبيه: كلفة الترويج = 0، تأكد من إدخالها إذا كانت هناك تكلفة فعلية قبل التأكيد
                  </p>
                </div>
              )}
              {promotionProofPreview && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">صورة إثبات الترويج المُرفقة:</p>
                  <img src={promotionProofPreview} alt="معاينة إثبات الترويج" className="max-h-24 rounded-lg border" />
                </div>
              )}
            </div>

            <Button onClick={handleConfirm} disabled={createMutation.isPending} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {createMutation.isPending ? confirmButtonLoadingLabel : confirmButtonIdleLabel}
            </Button>
          </CardContent>
        </Card>
      )}

      {canQuery && (
        <Button onClick={handlePreview} variant="outline" disabled={preview.isFetching} className="gap-2">
          <Eye className="w-4 h-4" />
          {preview.isFetching ? previewButtonLoadingLabel : previewButtonIdleLabel}
        </Button>
      )}
        </TabsContent>

        <TabsContent value="balances">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">أرصدة أصحاب الحصص بالهيكل التنظيمي</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>التاجر</TableHead>
                      <TableHead>الرتبة</TableHead>
                      <TableHead>الرصيد الحالي</TableHead>
                      <TableHead>إجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balances.data?.map(m => (
                      <Fragment key={m.id}>
                        <TableRow>
                          <TableCell>{m.name}</TableCell>
                          <TableCell><RoleBadge role={m.role} /></TableCell>
                          <TableCell className="font-semibold text-primary">{m.balance.toLocaleString()} د.ع</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setExpandedMerchantId(expandedMerchantId === m.id ? null : m.id)}
                                className="gap-1"
                              >
                                {expandedMerchantId === m.id ? "إخفاء التفاصيل" : "عرض التفاصيل"}
                              </Button>
                              {/* Bulk settle - UNCHANGED, exactly as before. */}
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={m.balance <= 0}
                                onClick={() => openSettleDialog(m.id, m.name, m.balance)}
                                className="gap-1"
                              >
                                <Wallet className="w-3.5 h-3.5" />
                                تسوية الرصيد
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedMerchantId === m.id && (
                          <TableRow>
                            <TableCell colSpan={4} className="bg-muted/30 p-4">
                              {merchantShareDetails.isLoading ? (
                                <p className="text-sm text-muted-foreground text-center py-4">جاري التحميل...</p>
                              ) : merchantShareDetails.data && merchantShareDetails.data.length > 0 ? (
                                <div className="space-y-2">
                                  {merchantShareDetails.data.map(share => (
                                    <div key={share.shareId} className="rounded-lg border bg-background p-3 flex items-center justify-between gap-4 flex-wrap">
                                      <div className="flex-1 min-w-[200px]">
                                        <p className="text-sm font-medium">
                                          {new Date(share.settlement.periodStart).toLocaleDateString("ar-IQ")} - {new Date(share.settlement.periodEnd).toLocaleDateString("ar-IQ")}
                                          <span className="text-muted-foreground"> — {share.settlement.sourceMerchantName}</span>
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          صافي الربح: {share.settlement.netProfit.toLocaleString()} د.ع — كلفة الترويج: {share.settlement.promotionCost.toLocaleString()} د.ع
                                        </p>
                                      </div>
                                      {share.settlement.promotionProofUrl && (
                                        <ImageLightbox src={share.settlement.promotionProofUrl} alt="إثبات الترويج" className="max-h-16 rounded-lg border" />
                                      )}
                                      <div className="flex items-center gap-3 shrink-0">
                                        <p className="text-lg font-bold text-primary">{share.shareAmount.toLocaleString()} د.ع</p>
                                        <Button size="sm" onClick={() => openSettleShareDialog(share.shareId, share.shareAmount)} className="gap-1">
                                          <Wallet className="w-3.5 h-3.5" />
                                          دفع
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">لا توجد حصص غير مدفوعة لهذا التاجر</p>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                    {balances.data?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          لا يوجد أصحاب حصص حالياً
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">سجل كل الدفعات</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>التاجر</TableHead>
                      <TableHead>الرتبة</TableHead>
                      <TableHead>المبلغ</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الملاحظة</TableHead>
                      <TableHead>صورة إثبات الدفع</TableHead>
                      <TableHead>صورة إثبات الترويج</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allPayouts.data?.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>{p.merchantName}</TableCell>
                        <TableCell><RoleBadge role={p.merchantRole} /></TableCell>
                        <TableCell className="font-semibold text-primary">{p.amount.toLocaleString()} د.ع</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString("ar-IQ")}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.note || "—"}</TableCell>
                        <TableCell>
                          {p.proofUrl ? (
                            <ImageLightbox src={p.proofUrl} alt="إثبات الدفع" className="max-h-12 rounded-lg border" />
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {p.promotionProofUrl ? (
                            <ImageLightbox src={p.promotionProofUrl} alt="إثبات الترويج" className="max-h-12 rounded-lg border" />
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {allPayouts.data?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          لا توجد دفعات مسجّلة بعد
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Settle Payout Dialog */}
      <Dialog open={showSettleDialog} onOpenChange={setShowSettleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تسوية الرصيد</DialogTitle>
            <DialogDescription>
              تسوية رصيد التاجر: <strong>{settleMerchantName}</strong>
              <br />
              سيتم اعتبار كامل الرصيد الحالي مدفوعاً بالكامل، ولا يمكن التراجع عن هذه العملية.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                هذا الإجراء يدمج كل الحصص المعلّقة بدفعة واحدة، وتفقد بعدها إمكانية معرفة أي حصة تعود لأي سكرين ترويج تحديداً.
                استخدم زر "دفع" الفردي لكل حصة (بتبويب "أرصدة التجار" ← "عرض التفاصيل") إذا تريد تتبع كل سكرين لحاله.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm font-semibold">المبلغ الذي سيتم تسليمه:</p>
              <p className="text-2xl font-bold text-primary">{settleAmount.toLocaleString()} د.ع</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="settle-note">ملاحظة (اختياري)</Label>
              <Textarea
                id="settle-note"
                placeholder="مثال: تم التسليم نقداً بتاريخ ..."
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>صورة إثبات الدفع (اختياري)</Label>
              <div
                className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => settleFileInputRef.current?.click()}
              >
                {settleProofPreview ? (
                  <img src={settleProofPreview} alt="معاينة إثبات الدفع" className="max-h-32 mx-auto rounded-lg" />
                ) : (
                  <div className="py-3">
                    <ImagePlus className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                    <p className="text-sm text-muted-foreground">اضغط لرفع صورة إثبات</p>
                  </div>
                )}
                <input ref={settleFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleSettleFileChange} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowSettleDialog(false)}>
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={handleSettlePayout}
                disabled={settlePayoutMutation.isPending}
                className="gap-2"
              >
                {settlePayoutMutation.isPending ? "جاري التسوية..." : (<><Wallet className="w-4 h-4" /> تأكيد التسوية</>)}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Single-share Payout Dialog - independent of the bulk "تسوية الرصيد"
          dialog above; settlePayoutMutation/settleMerchantPayout stay
          completely unchanged. */}
      <Dialog open={showSettleShareDialog} onOpenChange={setShowSettleShareDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>دفع حصة واحدة</DialogTitle>
            <DialogDescription>
              سيتم اعتبار هذه الحصة وحدها مدفوعة بالكامل، ولا يمكن التراجع عن هذه العملية.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm font-semibold">مبلغ هذه الحصة:</p>
              <p className="text-2xl font-bold text-primary">{settleShareAmount.toLocaleString()} د.ع</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="settle-share-note">ملاحظة (اختياري)</Label>
              <Textarea
                id="settle-share-note"
                placeholder="مثال: تم التسليم نقداً بتاريخ ..."
                value={settleShareNote}
                onChange={(e) => setSettleShareNote(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>صورة إثبات الدفع (اختياري)</Label>
              <div
                className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => settleShareFileInputRef.current?.click()}
              >
                {settleShareProofPreview ? (
                  <img src={settleShareProofPreview} alt="معاينة إثبات الدفع" className="max-h-32 mx-auto rounded-lg" />
                ) : (
                  <div className="py-3">
                    <ImagePlus className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                    <p className="text-sm text-muted-foreground">اضغط لرفع صورة إثبات</p>
                  </div>
                )}
                <input ref={settleShareFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleSettleShareFileChange} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowSettleShareDialog(false)}>
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={handleSettleSingleShare}
                disabled={settleSingleShareMutation.isPending}
                className="gap-2"
              >
                {settleSingleShareMutation.isPending ? "جاري الدفع..." : (<><Wallet className="w-4 h-4" /> تأكيد الدفع</>)}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

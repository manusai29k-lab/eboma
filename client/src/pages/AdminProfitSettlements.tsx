import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Percent, Eye, CheckCircle2, ImagePlus, AlertTriangle, Wallet } from "lucide-react";
import { ROLE_CONFIG } from "@/lib/merchantRoles";
import { RoleBadge } from "@/components/RoleBadge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState, useMemo, useRef } from "react";

const previewButtonIdleLabel = "معاينة";
const previewButtonLoadingLabel = "جاري الحساب...";
const confirmButtonIdleLabel = "تأكيد التسوية";
const confirmButtonLoadingLabel = "جاري التسوية...";

export default function AdminProfitSettlements() {
  const [merchantId, setMerchantId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
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

  const period = useMemo(() => {
    if (!startDate || !endDate) return null;
    return {
      periodStart: new Date(startDate),
      periodEnd: new Date(endDate + "T23:59:59"),
    };
  }, [startDate, endDate]);

  const canQuery = merchantId !== "" && period !== null;

  const orders = trpc.profitSettlements.unsettledOrders.useQuery(
    canQuery ? { merchantId: parseInt(merchantId), ...period! } : ({} as any),
    { enabled: canQuery, refetchOnWindowFocus: false }
  );

  const preview = trpc.profitSettlements.preview.useQuery(
    canQuery ? { merchantId: parseInt(merchantId), ...period!, promotionCost: parseFloat(promotionCost) || 0 } : ({} as any),
    { enabled: false }
  );

  const utils = trpc.useUtils();
  const createMutation = trpc.profitSettlements.create.useMutation({
    onSuccess: () => {
      toast.success("تمت تسوية الأرباح الهرمية بنجاح");
      setShowPreview(false);
      setMerchantId("");
      setStartDate("");
      setEndDate("");
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
      toast.error("يرجى اختيار التاجر والفترة أولاً");
      return;
    }
    const result = await preview.refetch();
    if (result.data) setShowPreview(true);
  };

  const handleConfirm = () => {
    if (!canQuery) return;
    createMutation.mutate({
      merchantId: parseInt(merchantId),
      ...period!,
      promotionCost: parseFloat(promotionCost) || 0,
      promotionProofBase64: promotionProofName ? (promotionProofPreview ?? undefined) : undefined,
      promotionProofName,
    });
  };

  const orderRows = orders.data ?? [];
  const totalGrossProfit = orderRows.reduce((acc, o) => acc + o.grossProfitAtOrderTime, 0);
  const breakdown = preview.data;
  const promotionCostValue = parseFloat(promotionCost) || 0;

  // Balances tab - every merchant currently holding (or having held) an
  // ancestor override share, with a one-click payout that sweeps their
  // entire current outstanding balance (see db.settleMerchantPayout).
  const balances = trpc.profitSettlements.balances.useQuery(undefined, { refetchOnWindowFocus: false });

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">تسويات الأرباح الهرمية</h1>
        <p className="text-sm text-muted-foreground mt-1">
          توزيع صافي الربح على التاجر المباشر وكل الأسلاف صاحبي نسبة حصة إضافية بالهيكل التنظيمي
        </p>
      </div>

      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="create">
            <Percent className="w-4 h-4 ms-2" />
            إنشاء تسوية جديدة
          </TabsTrigger>
          <TabsTrigger value="balances">
            <Wallet className="w-4 h-4 ms-2" />
            أرصدة التجار
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>التاجر</Label>
              <Select value={merchantId} onValueChange={(v) => { setMerchantId(v); setShowPreview(false); }}>
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
            <div className="space-y-2">
              <Label>من تاريخ</Label>
              <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setShowPreview(false); }} />
            </div>
            <div className="space-y-2">
              <Label>إلى تاريخ</Label>
              <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setShowPreview(false); }} />
            </div>
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
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        لا توجد طلبات مُسلَّمة غير مسوّاة لهذا التاجر بهذه الفترة
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
                      <TableRow key={m.id}>
                        <TableCell>{m.name}</TableCell>
                        <TableCell><RoleBadge role={m.role} /></TableCell>
                        <TableCell className="font-semibold text-primary">{m.balance.toLocaleString()} د.ع</TableCell>
                        <TableCell>
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
                        </TableCell>
                      </TableRow>
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
    </div>
  );
}

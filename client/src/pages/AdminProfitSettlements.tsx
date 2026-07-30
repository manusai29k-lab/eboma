import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Percent, Eye, CheckCircle2 } from "lucide-react";
import { ROLE_CONFIG } from "@/lib/merchantRoles";
import { toast } from "sonner";
import { useState, useMemo } from "react";

const previewButtonIdleLabel = "معاينة";
const previewButtonLoadingLabel = "جاري الحساب...";
const confirmButtonIdleLabel = "تأكيد التسوية";
const confirmButtonLoadingLabel = "جاري التسوية...";

export default function AdminProfitSettlements() {
  const [merchantId, setMerchantId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [promotionCost, setPromotionCost] = useState<string>("0");
  const [showPreview, setShowPreview] = useState(false);

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
    });
  };

  const orderRows = orders.data ?? [];
  const totalGrossProfit = orderRows.reduce((acc, o) => acc + o.grossProfitAtOrderTime, 0);
  const breakdown = preview.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">تسويات الأرباح الهرمية</h1>
        <p className="text-sm text-muted-foreground mt-1">
          توزيع صافي الربح على التاجر المباشر وكل الأسلاف صاحبي نسبة حصة إضافية بالهيكل التنظيمي
        </p>
      </div>

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
            <div className="space-y-2">
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
    </div>
  );
}

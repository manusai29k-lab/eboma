import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Filter, ImageOff, TrendingUp, TrendingDown } from "lucide-react";
import { useState, useMemo } from "react";

const STATUS_LABELS: Record<string, string> = {
  new: "جديد", preparing: "قيد التجهيز", shipped: "تم الشحن",
  delivered: "تم التسليم", cancelled: "ملغي", returned: "مرتجع",
};

export default function AdminProductProfitReport() {
  const merchants = trpc.merchants.list.useQuery(undefined, { refetchOnWindowFocus: false });

  const [merchantId, setMerchantId] = useState<string>("all");
  // Defaults to "delivered" - same revenue-realization convention as
  // AdminReports (dashboard/report totals only count delivered orders).
  const [status, setStatus] = useState<string>("delivered");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  const filters = useMemo(() => ({
    merchantId: merchantId !== "all" ? parseInt(merchantId) : undefined,
    status: status !== "all" ? status : undefined,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate + "T23:59:59") : undefined,
  }), [merchantId, status, startDate, endDate]);

  const report = trpc.physicalOrders.productProfitReport.useQuery(filters, { refetchOnWindowFocus: false });

  const products = useMemo(() => {
    return [...(report.data ?? [])].sort((a, b) => b.profit - a.profit);
  }, [report.data]);

  const totals = useMemo(() => {
    return products.reduce((acc, p) => ({
      revenue: acc.revenue + p.revenue,
      profit: acc.profit + p.profit,
      orderCount: acc.orderCount + p.orderCount,
    }), { revenue: 0, profit: 0, orderCount: 0 });
  }, [products]);

  const selectedProduct = products.find(p => p.productId === selectedProductId) ?? null;

  const detailFilters = useMemo(() => ({
    ...filters,
    productId: selectedProductId ?? undefined,
  }), [filters, selectedProductId]);

  const detail = trpc.physicalOrders.filtered.useQuery(detailFilters, {
    enabled: selectedProductId !== null,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">تقرير أرباح المنتجات</h1>
        <p className="text-sm text-muted-foreground mt-1">صافي ربح كل منتج بالفترة المحددة (طلبات الكتالوج فقط)</p>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" />
            معايير التصفية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>التاجر</Label>
              <Select value={merchantId} onValueChange={setMerchantId}>
                <SelectTrigger><SelectValue placeholder="الكل" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع التجار</SelectItem>
                  {merchants.data?.map(m => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="new">جديد</SelectItem>
                  <SelectItem value="preparing">قيد التجهيز</SelectItem>
                  <SelectItem value="shipped">تم الشحن</SelectItem>
                  <SelectItem value="delivered">تم التسليم</SelectItem>
                  <SelectItem value="returned">مرتجع</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>من تاريخ</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>إلى تاريخ</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="py-4 text-center"><p className="text-sm text-muted-foreground">عدد الطلبات</p><p className="text-2xl font-bold">{totals.orderCount}</p></CardContent></Card>
        <Card><CardContent className="py-4 text-center"><p className="text-sm text-muted-foreground">إجمالي الإيراد</p><p className="text-2xl font-bold text-primary">{totals.revenue.toLocaleString()} د.ع</p></CardContent></Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-sm text-muted-foreground">صافي الربح الإجمالي</p>
            <p className={`text-2xl font-bold ${totals.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {totals.profit.toLocaleString()} د.ع
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Product Grid */}
      {report.isLoading ? (
        <p className="text-center text-muted-foreground py-12">جاري التحميل...</p>
      ) : products.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">لا توجد بيانات ربح لهذه الفترة</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map(p => {
            const isProfit = p.profit >= 0;
            const margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
            return (
              <Card
                key={p.productId}
                className={`shadow-sm cursor-pointer hover:shadow-md transition-shadow border-2 ${isProfit ? "border-emerald-500/20" : "border-red-500/20"}`}
                onClick={() => setSelectedProductId(p.productId)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <ImageOff className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.orderCount} طلب · {p.unitsSold} قطعة</p>
                    </div>
                  </div>

                  <div className={`rounded-lg p-3 flex items-center justify-between ${isProfit ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                    <div className="flex items-center gap-1.5">
                      {isProfit ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
                      <span className={`font-bold ${isProfit ? "text-emerald-600" : "text-red-600"}`}>
                        {p.profit.toLocaleString()} د.ع
                      </span>
                    </div>
                    <Badge variant="outline" className={isProfit ? "text-emerald-600 border-emerald-500/30" : "text-red-600 border-red-500/30"}>
                      {margin.toFixed(1)}%
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground">الإيراد: {p.revenue.toLocaleString()} د.ع</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={selectedProductId !== null} onOpenChange={(open) => !open && setSelectedProductId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedProduct ? `تفاصيل: ${selectedProduct.name}` : "تفاصيل المنتج"}</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="grid grid-cols-3 gap-3 text-center mb-2">
              <div className="rounded-lg bg-muted p-2">
                <p className="text-xs text-muted-foreground">الإيراد</p>
                <p className="font-bold">{selectedProduct.revenue.toLocaleString()} د.ع</p>
              </div>
              <div className={`rounded-lg p-2 ${selectedProduct.profit >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                <p className="text-xs text-muted-foreground">صافي الربح</p>
                <p className={`font-bold ${selectedProduct.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {selectedProduct.profit.toLocaleString()} د.ع
                </p>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <p className="text-xs text-muted-foreground">عدد الطلبات</p>
                <p className="font-bold">{selectedProduct.orderCount}</p>
              </div>
            </div>
          )}
          <div className="overflow-x-auto max-h-[50vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>التاجر</TableHead>
                  <TableHead>الزبون</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>الربح</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">جاري التحميل...</TableCell></TableRow>
                ) : (detail.data ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">لا توجد طلبات</TableCell></TableRow>
                ) : (
                  (detail.data ?? []).map(o => (
                    <TableRow key={o.id}>
                      <TableCell>#{o.id}</TableCell>
                      <TableCell>{o.merchantName}</TableCell>
                      <TableCell>{o.customerName}</TableCell>
                      <TableCell>{o.quantity}</TableCell>
                      <TableCell className="font-medium">{o.totalPrice.toLocaleString()} د.ع</TableCell>
                      <TableCell className={o.grossProfitAtOrderTime >= 0 ? "text-emerald-600" : "text-red-600"}>
                        {o.grossProfitAtOrderTime.toLocaleString()} د.ع
                      </TableCell>
                      <TableCell><Badge variant="outline">{STATUS_LABELS[o.status] || o.status}</Badge></TableCell>
                      <TableCell className="text-xs">{new Date(o.createdAt).toLocaleDateString("ar-IQ")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

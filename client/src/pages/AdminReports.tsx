import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Filter, Download } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";

const STATUS_LABELS: Record<string, string> = {
  new: "جديد", preparing: "قيد التجهيز", shipped: "تم الشحن",
  delivered: "تم التسليم", cancelled: "ملغي", returned: "مرتجع",
};

export default function AdminReports() {
  const [, setLocation] = useLocation();



  const merchants = trpc.merchants.list.useQuery(undefined, { refetchOnWindowFocus: false });

  const [merchantId, setMerchantId] = useState<string>("all");
  const [productType, setProductType] = useState<string>("all");
  // Defaults to "delivered" so the totals shown on load match the dashboard's
  // revenue definition (physical: delivered only; digital: delivered is the
  // creation-time default, so this only excludes ones later cancelled). The
  // admin can still switch to "all" or any other status manually.
  const [status, setStatus] = useState<string>("delivered");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [orderType, setOrderType] = useState<string>("all");

  const filters = useMemo(() => ({
    merchantId: merchantId !== "all" ? parseInt(merchantId) : undefined,
    productType: productType !== "all" ? productType : undefined,
    status: status !== "all" ? status : undefined,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate + "T23:59:59") : undefined,
  }), [merchantId, productType, status, startDate, endDate]);

  const physicalOrders = trpc.physicalOrders.filtered.useQuery(filters, {
    enabled: orderType === "all" || orderType === "physical",
    refetchOnWindowFocus: false,
  });
  const digitalSales = trpc.digitalSales.filtered.useQuery(filters, {
    enabled: orderType === "all" || orderType === "digital",
    refetchOnWindowFocus: false,
  });

  const physData = physicalOrders.data ?? [];
  const digiData = digitalSales.data ?? [];
  const totalPhysRevenue = physData.reduce((sum, o) => sum + o.totalPrice, 0);
  const totalDigiRevenue = digiData.reduce((sum, s) => sum + s.productPrice, 0);
  const totalRevenue = totalPhysRevenue + totalDigiRevenue;

  const exportCSV = () => {
    const rows: string[] = [];
    rows.push("النوع,رقم,التاجر,العميل/الزبون,المنتج,الكمية,السعر,الإجمالي,الحالة,التاريخ");
    physData.forEach(o => {
      rows.push(`مادي,${o.id},${o.merchantName},${o.customerName},${o.productType},${o.quantity},${o.productPrice},${o.totalPrice},${STATUS_LABELS[o.status] || o.status},${new Date(o.createdAt).toLocaleDateString("ar-IQ")}`);
    });
    digiData.forEach(s => {
      rows.push(`رقمي,${s.id},${s.merchantName},${s.customerPhone},${s.productType},1,${s.productPrice},${s.productPrice},تم التسليم,${new Date(s.createdAt).toLocaleDateString("ar-IQ")}`);
    });
    const csv = "\uFEFF" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eboma-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">التقارير</h1>
          <p className="text-sm text-muted-foreground mt-1">تصفية وتصدير التقارير حسب المعايير</p>
        </div>
        <Button onClick={exportCSV} variant="outline">
          <Download className="w-4 h-4 ms-2" />
          تصدير CSV
        </Button>
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
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
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
              <Label>نوع الطلب</Label>
              <Select value={orderType} onValueChange={setOrderType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="physical">مادي</SelectItem>
                  <SelectItem value="digital">رقمي</SelectItem>
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
                  <SelectItem value="cancelled">ملغي</SelectItem>
                  <SelectItem value="returned">مرتجع</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>اسم/نوع المنتج</Label>
              <Input value={productType} onChange={(e) => setProductType(e.target.value)} placeholder="كل المنتجات" />
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
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card><CardContent className="py-4 text-center"><p className="text-sm text-muted-foreground">إجمالي الطلبات</p><p className="text-2xl font-bold">{physData.length + digiData.length}</p></CardContent></Card>
        <Card><CardContent className="py-4 text-center"><p className="text-sm text-muted-foreground">طلبات مادية</p><p className="text-2xl font-bold text-blue-600">{physData.length}</p></CardContent></Card>
        <Card><CardContent className="py-4 text-center"><p className="text-sm text-muted-foreground">مبيعات رقمية</p><p className="text-2xl font-bold text-green-600">{digiData.length}</p></CardContent></Card>
        <Card><CardContent className="py-4 text-center"><p className="text-sm text-muted-foreground">إجمالي المبيعات</p><p className="text-2xl font-bold text-primary">{totalRevenue.toLocaleString()} د.ع</p></CardContent></Card>
        <Card><CardContent className="py-4 text-center"><p className="text-sm text-muted-foreground">مرتجعة</p><p className="text-2xl font-bold text-orange-600">{physData.filter(o => o.status === "returned").length}</p></CardContent></Card>
        <Card><CardContent className="py-4 text-center"><p className="text-sm text-muted-foreground">ملغاة</p><p className="text-2xl font-bold text-red-600">{physData.filter(o => o.status === "cancelled").length}</p></CardContent></Card>
      </div>

      {/* Results Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            نتائج التقرير
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>النوع</TableHead>
                  <TableHead>#</TableHead>
                  <TableHead>التاجر</TableHead>
                  <TableHead>العميل/الزبون</TableHead>
                  <TableHead>المنتج</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {physData.map(o => (
                  <TableRow key={`p-${o.id}`}>
                    <TableCell><Badge variant="outline" className="bg-blue-50">مادي</Badge></TableCell>
                    <TableCell>#{o.id}</TableCell>
                    <TableCell>{o.merchantName}</TableCell>
                    <TableCell>{o.customerName}</TableCell>
                    <TableCell>{o.productType} ×{o.quantity}</TableCell>
                    <TableCell className="font-semibold">{o.totalPrice.toLocaleString()} د.ع</TableCell>
                    <TableCell><Badge variant="outline">{STATUS_LABELS[o.status] || o.status}</Badge></TableCell>
                    <TableCell className="text-xs">{new Date(o.createdAt).toLocaleDateString("ar-IQ")}</TableCell>
                  </TableRow>
                ))}
                {digiData.map(s => (
                  <TableRow key={`d-${s.id}`}>
                    <TableCell><Badge variant="outline" className="bg-green-50">رقمي</Badge></TableCell>
                    <TableCell>#{s.id}</TableCell>
                    <TableCell>{s.merchantName}</TableCell>
                    <TableCell dir="ltr">{s.customerPhone}</TableCell>
                    <TableCell>{s.productType}</TableCell>
                    <TableCell className="font-semibold">{s.productPrice.toLocaleString()} د.ع</TableCell>
                    <TableCell><Badge variant="outline" className="bg-green-100">تم التسليم</Badge></TableCell>
                    <TableCell className="text-xs">{new Date(s.createdAt).toLocaleDateString("ar-IQ")}</TableCell>
                  </TableRow>
                ))}
                {physData.length === 0 && digiData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا توجد نتائج</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

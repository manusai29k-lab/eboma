import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Wallet, Filter, Download } from "lucide-react";
import { useState, useMemo } from "react";

export default function AdminSettlements() {
  const merchants = trpc.merchants.list.useQuery(undefined, { refetchOnWindowFocus: false });

  const [merchantId, setMerchantId] = useState<string>("all");
  const [merchantType, setMerchantType] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const filters = useMemo(() => ({
    merchantId: merchantId !== "all" ? parseInt(merchantId) : undefined,
    merchantType: merchantType !== "all" ? (merchantType as "physical" | "digital") : undefined,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate + "T23:59:59") : undefined,
  }), [merchantId, merchantType, startDate, endDate]);

  const settlements = trpc.settlements.list.useQuery(filters, { refetchOnWindowFocus: false });
  const data = settlements.data ?? [];

  const totalAmount = data.reduce((sum, s) => sum + s.amount, 0);
  const totalDelivered = data.reduce((sum, s) => sum + s.deliveredCount, 0);
  const totalCancelled = data.reduce((sum, s) => sum + s.cancelledCount, 0);

  const exportCSV = () => {
    const rows: string[] = [];
    rows.push("التاريخ,التاجر,النوع,المبلغ,عدد المسلمة,عدد الملغاة/المرتجعة,ملاحظة");
    data.forEach(s => {
      const note = (s.note ?? "").replace(/[\r\n,]+/g, " ");
      rows.push(`${new Date(s.createdAt).toLocaleDateString("ar-IQ")},${s.merchantName},${s.merchantType === "physical" ? "مادي" : "رقمي"},${s.amount},${s.deliveredCount},${s.cancelledCount},${note}`);
    });
    const csv = "﻿" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eboma-settlements-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">سجل التسويات</h1>
          <p className="text-sm text-muted-foreground mt-1">أرشيف كل عمليات تسوية الأرباح مع التجار</p>
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
              <Label>النوع</Label>
              <Select value={merchantType} onValueChange={setMerchantType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="physical">مادي</SelectItem>
                  <SelectItem value="digital">رقمي</SelectItem>
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="py-4 text-center"><p className="text-sm text-muted-foreground">عدد التسويات</p><p className="text-2xl font-bold">{data.length}</p></CardContent></Card>
        <Card><CardContent className="py-4 text-center"><p className="text-sm text-muted-foreground">إجمالي المبالغ المسلّمة</p><p className="text-2xl font-bold text-primary">{totalAmount.toLocaleString()} د.ع</p></CardContent></Card>
        <Card><CardContent className="py-4 text-center"><p className="text-sm text-muted-foreground">إجمالي الطلبات الواصلة</p><p className="text-2xl font-bold text-emerald-600">{totalDelivered}</p></CardContent></Card>
        <Card><CardContent className="py-4 text-center"><p className="text-sm text-muted-foreground">إجمالي الملغاة/المرتجعة</p><p className="text-2xl font-bold text-red-600">{totalCancelled}</p></CardContent></Card>
      </div>

      {/* Results Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            نتائج السجل
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>التاجر</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>عدد المسلّمة</TableHead>
                  <TableHead>عدد الملغاة/المرتجعة</TableHead>
                  <TableHead>ملاحظة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs">{new Date(s.createdAt).toLocaleDateString("ar-IQ")}</TableCell>
                    <TableCell>{s.merchantName}</TableCell>
                    <TableCell>
                      <Badge variant={s.merchantType === "physical" ? "default" : "secondary"}>
                        {s.merchantType === "physical" ? "مادي" : "رقمي"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-primary">{s.amount.toLocaleString()} د.ع</TableCell>
                    <TableCell>{s.deliveredCount}</TableCell>
                    <TableCell>{s.cancelledCount}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{s.note || "—"}</TableCell>
                  </TableRow>
                ))}
                {data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا توجد تسويات</TableCell>
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

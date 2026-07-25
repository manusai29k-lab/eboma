import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Package, Smartphone, Eye } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useState } from "react";

const STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  preparing: "قيد التجهيز",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
  returned: "مرتجع",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 border-blue-200",
  preparing: "bg-yellow-100 text-yellow-800 border-yellow-200",
  shipped: "bg-purple-100 text-purple-800 border-purple-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  returned: "bg-orange-100 text-orange-800 border-orange-200",
};

export default function AdminOrders() {
  const [, setLocation] = useLocation();
  const [selectedProof, setSelectedProof] = useState<string | null>(null);



  const physicalOrders = trpc.physicalOrders.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const digitalSales = trpc.digitalSales.list.useQuery(undefined, { refetchOnWindowFocus: false });

  const updateStatusMutation = trpc.physicalOrders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الحالة");
      physicalOrders.refetch();
    },
    onError: () => toast.error("فشل تحديث الحالة"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">إدارة الطلبات</h1>
        <p className="text-sm text-muted-foreground mt-1">عرض وإدارة جميع الطلبات والمبيعات</p>
      </div>

      <Tabs defaultValue="physical" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="physical">
            <Package className="w-4 h-4 ms-2" />
            الطلبات المادية ({physicalOrders.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="digital">
            <Smartphone className="w-4 h-4 ms-2" />
            المبيعات الرقمية ({digitalSales.data?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* Physical Orders */}
        <TabsContent value="physical">
          <Card className="shadow-sm">
            <CardContent className="p-0">
              {physicalOrders.data && physicalOrders.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>التاجر</TableHead>
                        <TableHead>العميل</TableHead>
                        <TableHead>المنتج</TableHead>
                        <TableHead>الكمية</TableHead>
                        <TableHead>الإجمالي</TableHead>
                        <TableHead>العنوان</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>التاريخ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {physicalOrders.data.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">#{order.id}</TableCell>
                          <TableCell>{order.merchantName}</TableCell>
                          <TableCell>
                            <div>
                              <p>{order.customerName}</p>
                              <p className="text-xs text-muted-foreground" dir="ltr">{order.customerPhone}</p>
                            </div>
                          </TableCell>
                          <TableCell>{order.productType}</TableCell>
                          <TableCell>{order.quantity}</TableCell>
                          <TableCell className="font-semibold">{order.totalPrice.toLocaleString()} د.ع</TableCell>
                          <TableCell className="text-sm">{order.province} - {order.district}</TableCell>
                          <TableCell>
                            <Select
                              value={order.status}
                              onValueChange={(val) => updateStatusMutation.mutate({ id: order.id, status: val as any })}
                              disabled={updateStatusMutation.isPending}
                            >
                              <SelectTrigger className="w-32 h-8 text-xs">
                                <Badge className={STATUS_COLORS[order.status]} variant="outline">
                                  {STATUS_LABELS[order.status]}
                                </Badge>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">جديد</SelectItem>
                                <SelectItem value="preparing">قيد التجهيز</SelectItem>
                                <SelectItem value="shipped">تم الشحن</SelectItem>
                                <SelectItem value="delivered">تم التسليم</SelectItem>
                                <SelectItem value="cancelled">ملغي</SelectItem>
                                <SelectItem value="returned">مرتجع</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString("ar-IQ")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-12">لا توجد طلبات مادية</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Digital Sales */}
        <TabsContent value="digital">
          <Card className="shadow-sm">
            <CardContent className="p-0">
              {digitalSales.data && digitalSales.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>التاجر</TableHead>
                        <TableHead>رقم الزبون</TableHead>
                        <TableHead>المنتج</TableHead>
                        <TableHead>السعر</TableHead>
                        <TableHead>إثبات التحويل</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>التاريخ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {digitalSales.data.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell className="font-medium">#{sale.id}</TableCell>
                          <TableCell>{sale.merchantName}</TableCell>
                          <TableCell dir="ltr">{sale.customerPhone}</TableCell>
                          <TableCell>{sale.productType}</TableCell>
                          <TableCell className="font-semibold">{sale.productPrice.toLocaleString()} د.ع</TableCell>
                          <TableCell>
                            {sale.proofImageUrl ? (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm" onClick={() => setSelectedProof(sale.proofImageUrl!)}>
                                    <Eye className="w-4 h-4 ms-1" /> عرض
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>صورة إثبات التحويل - #{sale.id}</DialogTitle>
                                  </DialogHeader>
                                  <img src={selectedProof ?? sale.proofImageUrl} alt="إثبات" className="w-full rounded-lg" />
                                </DialogContent>
                              </Dialog>
                            ) : (
                              <span className="text-xs text-muted-foreground">لا يوجد</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_COLORS[sale.status] || "bg-gray-100"} variant="outline">
                              {STATUS_LABELS[sale.status] || sale.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(sale.createdAt).toLocaleDateString("ar-IQ")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-12">لا توجد مبيعات رقمية</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

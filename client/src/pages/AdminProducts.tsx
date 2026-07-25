import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Package, Smartphone, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useState } from "react";

export default function AdminProducts() {
  const [, setLocation] = useLocation();



  const physicalProducts = trpc.physicalProducts.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const digitalProducts = trpc.digitalProducts.list.useQuery(undefined, { refetchOnWindowFocus: false });

  const createPhysMutation = trpc.physicalProducts.create.useMutation({
    onSuccess: () => { toast.success("تم إضافة المنتج"); physicalProducts.refetch(); },
    onError: () => toast.error("فشل الإضافة"),
  });
  const updatePhysMutation = trpc.physicalProducts.update.useMutation({
    onSuccess: () => { toast.success("تم تحديث المنتج"); physicalProducts.refetch(); },
    onError: () => toast.error("فشل التحديث"),
  });
  const deletePhysMutation = trpc.physicalProducts.delete.useMutation({
    onSuccess: () => { toast.success("تم حذف المنتج"); physicalProducts.refetch(); },
    onError: () => toast.error("فشل الحذف"),
  });

  const createDigiMutation = trpc.digitalProducts.create.useMutation({
    onSuccess: () => { toast.success("تم إضافة المنتج"); digitalProducts.refetch(); },
    onError: () => toast.error("فشل الإضافة"),
  });
  const updateDigiMutation = trpc.digitalProducts.update.useMutation({
    onSuccess: () => { toast.success("تم تحديث المنتج"); digitalProducts.refetch(); },
    onError: () => toast.error("فشل التحديث"),
  });
  const deleteDigiMutation = trpc.digitalProducts.delete.useMutation({
    onSuccess: () => { toast.success("تم حذف المنتج"); digitalProducts.refetch(); },
    onError: () => toast.error("فشل الحذف"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">إدارة المنتجات</h1>
        <p className="text-sm text-muted-foreground mt-1">إضافة وتعديل وحذف المنتجات المادية والرقمية</p>
      </div>

      <Tabs defaultValue="physical" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="physical">
            <Package className="w-4 h-4 ms-2" />
            منتجات مادية ({physicalProducts.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="digital">
            <Smartphone className="w-4 h-4 ms-2" />
            منتجات رقمية ({digitalProducts.data?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* Physical Products */}
        <TabsContent value="physical">
          <Card className="shadow-sm">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-lg">المنتجات المادية</CardTitle>
              <ProductDialog
                title="إضافة منتج مادي"
                trigger={<Button size="sm"><Plus className="w-4 h-4 ms-2" /> إضافة منتج</Button>}
                onSubmit={(data) => createPhysMutation.mutate(data)}
              />
            </CardHeader>
            <CardContent className="p-0">
              {physicalProducts.data && physicalProducts.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الاسم</TableHead>
                        <TableHead>النوع</TableHead>
                        <TableHead>السعر</TableHead>
                        <TableHead>الوصف</TableHead>
                        <TableHead>إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {physicalProducts.data.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{product.type}</TableCell>
                          <TableCell>{product.price.toLocaleString()} د.ع</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{product.description || "-"}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <ProductDialog
                                title="تعديل منتج"
                                trigger={<Button variant="ghost" size="icon" title="تعديل"><Pencil className="w-4 h-4" /></Button>}
                                initial={product}
                                onSubmit={(data) => updatePhysMutation.mutate({ id: product.id, ...data })}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                title="حذف"
                                onClick={() => { if (confirm("هل أنت متأكد من الحذف؟")) deletePhysMutation.mutate({ id: product.id }); }}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-12">لا توجد منتجات مادية</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Digital Products */}
        <TabsContent value="digital">
          <Card className="shadow-sm">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-lg">المنتجات الرقمية</CardTitle>
              <ProductDialog
                title="إضافة منتج رقمي"
                trigger={<Button size="sm"><Plus className="w-4 h-4 ms-2" /> إضافة منتج</Button>}
                onSubmit={(data) => createDigiMutation.mutate(data)}
              />
            </CardHeader>
            <CardContent className="p-0">
              {digitalProducts.data && digitalProducts.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الاسم</TableHead>
                        <TableHead>النوع</TableHead>
                        <TableHead>السعر</TableHead>
                        <TableHead>الوصف</TableHead>
                        <TableHead>إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {digitalProducts.data.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{product.type}</TableCell>
                          <TableCell>{product.price.toLocaleString()} د.ع</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{product.description || "-"}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <ProductDialog
                                title="تعديل منتج"
                                trigger={<Button variant="ghost" size="icon" title="تعديل"><Pencil className="w-4 h-4" /></Button>}
                                initial={product}
                                onSubmit={(data) => updateDigiMutation.mutate({ id: product.id, ...data })}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                title="حذف"
                                onClick={() => { if (confirm("هل أنت متأكد من الحذف؟")) deleteDigiMutation.mutate({ id: product.id }); }}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-12">لا توجد منتجات رقمية</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProductDialog({
  title,
  trigger,
  initial,
  onSubmit,
}: {
  title: string;
  trigger: React.ReactNode;
  initial?: { name: string; price: number; type: string; description?: string | null };
  onSubmit: (data: { name: string; price: number; type: string; description?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [type, setType] = useState(initial?.type ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !type) {
      toast.error("يرجى ملء الحقول المطلوبة");
      return;
    }
    onSubmit({
      name,
      price: parseInt(price),
      type,
      description: description || undefined,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="p-name">اسم المنتج *</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="p-price">السعر (د.ع) *</Label>
              <Input id="p-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} dir="ltr" className="text-end" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-type">النوع *</Label>
              <Input id="p-type" value={type} onChange={(e) => setType(e.target.value)} placeholder="مثال: كورس، كتاب" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-desc">الوصف</Label>
            <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <Button type="submit" className="w-full">حفظ</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

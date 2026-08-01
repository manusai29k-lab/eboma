import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Package, Smartphone, Plus, Pencil, Trash2, ImagePlus, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useState, useRef } from "react";

export default function AdminProducts() {
  const [, setLocation] = useLocation();



  const physicalProducts = trpc.physicalProducts.listAdmin.useQuery(undefined, { refetchOnWindowFocus: false });
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
              <PhysicalProductDialog
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
                        <TableHead>صورة</TableHead>
                        <TableHead>الاسم</TableHead>
                        <TableHead>النوع</TableHead>
                        <TableHead>السعر</TableHead>
                        <TableHead>المخزون</TableHead>
                        <TableHead>الوصف</TableHead>
                        <TableHead>إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {physicalProducts.data.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded-md object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                                <ImageOff className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{product.type}</TableCell>
                          <TableCell>{product.price.toLocaleString()} د.ع</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              defaultValue={product.stock}
                              className="w-20 h-8"
                              onBlur={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val !== product.stock) {
                                  updatePhysMutation.mutate({ id: product.id, stock: val });
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{product.description || "-"}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <PhysicalProductDialog
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

// Physical-only — separate from ProductDialog above so the digital tab
// (which keeps using ProductDialog unchanged) is never affected by the
// image/stock fields added here.
function PhysicalProductDialog({
  title,
  trigger,
  initial,
  onSubmit,
}: {
  title: string;
  trigger: React.ReactNode;
  initial?: { name: string; price: number; type: string; description?: string | null; stock?: number; imageUrl?: string | null; wholesaleCost?: number | null; deliveryCost?: number | null; minPrice?: number | null };
  onSubmit: (data: { name: string; price: number; type: string; description?: string; stock: number; wholesaleCost?: number; deliveryCost?: number; minPrice?: number; imageBase64?: string; imageName?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [type, setType] = useState(initial?.type ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [stock, setStock] = useState(initial?.stock !== undefined ? String(initial.stock) : "0");
  const [wholesaleCost, setWholesaleCost] = useState(initial?.wholesaleCost != null ? String(initial.wholesaleCost) : "");
  const [deliveryCost, setDeliveryCost] = useState(initial?.deliveryCost != null ? String(initial.deliveryCost) : "");
  const [minPrice, setMinPrice] = useState(initial?.minPrice != null ? String(initial.minPrice) : "");
  const [imagePreview, setImagePreview] = useState<string | null>(initial?.imageUrl ?? null);
  const [imageName, setImageName] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

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
      stock: parseInt(stock) || 0,
      wholesaleCost: wholesaleCost ? parseInt(wholesaleCost) : undefined,
      deliveryCost: deliveryCost ? parseInt(deliveryCost) : undefined,
      minPrice: minPrice ? parseInt(minPrice) : undefined,
      imageBase64: imageName ? (imagePreview ?? undefined) : undefined,
      imageName,
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
            <Label>صورة المنتج</Label>
            <div
              className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="معاينة" className="max-h-32 mx-auto rounded-lg" />
              ) : (
                <div className="py-4">
                  <ImagePlus className="w-8 h-8 mx-auto text-muted-foreground mb-1" />
                  <p className="text-sm text-muted-foreground">اضغط لرفع صورة المنتج</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pp-name">اسم المنتج *</Label>
            <Input id="pp-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pp-price">السعر المقترح (د.ع) *</Label>
              <Input id="pp-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} dir="ltr" className="text-end" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pp-type">النوع *</Label>
              <Input id="pp-type" value={type} onChange={(e) => setType(e.target.value)} placeholder="مثال: ملابس، إلكترونيات" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pp-min-price">الحد الأدنى للسعر (د.ع) - اختياري</Label>
            <Input id="pp-min-price" type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} dir="ltr" className="text-end w-40" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pp-stock">كمية المخزون</Label>
            <Input id="pp-stock" type="number" value={stock} onChange={(e) => setStock(e.target.value)} dir="ltr" className="text-end w-32" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pp-wholesale">تكلفة الجملة (د.ع)</Label>
              <Input id="pp-wholesale" type="number" value={wholesaleCost} onChange={(e) => setWholesaleCost(e.target.value)} dir="ltr" className="text-end" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pp-delivery">كلفة التوصيل (د.ع)</Label>
              <Input id="pp-delivery" type="number" value={deliveryCost} onChange={(e) => setDeliveryCost(e.target.value)} dir="ltr" className="text-end" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pp-desc">الوصف</Label>
            <Textarea id="pp-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <Button type="submit" className="w-full">حفظ</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

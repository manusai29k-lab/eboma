import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { ArrowRight, Package, Loader2, Info, Plus, ImageOff, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

const IRAQ_PROVINCES = [
  "بغداد", "البصرة", "نينوى", "أربيل", "السليمانية", "دهوك",
  "كركوك", "ديالى", "الأنبار", "بابل", "كربلاء", "النجف",
  "القادسية", "واسط", "ميسان", "ذي قار", "المثنى", "صلاح الدين",
];

export default function MerchantPhysical() {
  const [, setLocation] = useLocation();
  const merchantMe = trpc.merchant.me.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [productType, setProductType] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Product entry mode: "picker" = nothing chosen yet (show the catalog
  // button + manual-entry link), "selected" = a catalog product is locked
  // in (name display-only, price still editable), "manual" = free-text name
  // entry (original behavior, productId stays null so stock is never touched).
  const [entryMode, setEntryMode] = useState<"picker" | "selected" | "manual">("picker");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedProductImage, setSelectedProductImage] = useState<string | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");

  const catalogProducts = trpc.physicalProducts.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const filteredCatalog = (catalogProducts.data ?? []).filter((p) =>
    p.name.toLowerCase().includes(catalogSearch.trim().toLowerCase())
  );

  const pickProduct = (product: { id: number; name: string; price: number; imageUrl: string | null }) => {
    setSelectedProductId(product.id);
    setSelectedProductImage(product.imageUrl);
    setProductType(product.name);
    setProductPrice(String(product.price));
    setEntryMode("selected");
    setShowCatalog(false);
  };

  const clearProductSelection = () => {
    setSelectedProductId(null);
    setSelectedProductImage(null);
    setProductType("");
    setEntryMode("picker");
  };

  useEffect(() => {
    if (!merchantMe.isLoading && !merchantMe.data) {
      setLocation("/");
    }
  }, [merchantMe.isLoading, merchantMe.data, setLocation]);

  const createMutation = trpc.physicalOrders.create.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل الطلب بنجاح");
      setLocation("/merchant");
    },
    onError: (error) => {
      toast.error(error.message || "فشل تسجيل الطلب");
      setIsSubmitting(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantMe.data) return;
    if (!customerName || !customerPhone || !productType || productType === "custom" || !productPrice || !province || !district) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    const price = parseInt(productPrice);
    const qty = parseInt(quantity) || 1;
    if (price < 0) {
      toast.error("السعر يجب أن يكون رقماً موجباً");
      return;
    }
    setIsSubmitting(true);
    createMutation.mutate({
      merchantName: merchantMe.data.name,
      customerName,
      customerPhone,
      productType,
      productPrice: price,
      quantity: qty,
      province,
      district,
      notes: notes || undefined,
      productId: selectedProductId ?? undefined,
    });
  };

  if (merchantMe.isLoading || !merchantMe.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060814]">
        <p className="text-white/40">جاري التحميل...</p>
      </div>
    );
  }

  const inputClass = "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-violet-500/50 focus:bg-white/10";

  return (
    <div className="min-h-screen bg-[#060814] text-white relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-[250px] h-[250px] md:w-[400px] md:h-[400px] bg-violet-600/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/merchant")} className="text-white/50 hover:text-white hover:bg-white/5">
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700">
              <Package className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-bold text-white">تسجيل طلب - منتج مادي</h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 container py-8 max-w-2xl">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 to-transparent rounded-3xl blur-2xl" />
          <div className="relative bg-[#0d1020]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-1">معلومات الطلب</h2>
            <p className="text-sm text-white/40 mb-6">أدخل بيانات العميل والمنتج المطلوب</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customerName" className="text-white/70 text-sm">اسم العميل *</Label>
                <Input id="customerName" placeholder="أدخل اسم العميل" value={customerName} onChange={(e) => setCustomerName(e.target.value)} disabled={isSubmitting} className={inputClass} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerPhone" className="text-white/70 text-sm">رقم العميل *</Label>
                <Input id="customerPhone" type="tel" placeholder="أدخل رقم هاتف العميل" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} disabled={isSubmitting} dir="ltr" className={`text-end ${inputClass}`} />
              </div>

              <div className="space-y-2">
                <Label className="text-white/70 text-sm">المنتج *</Label>

                {entryMode === "selected" ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-white/5 border border-violet-500/30 p-3">
                    <div className="flex items-center gap-3">
                      {selectedProductImage ? (
                        <img src={selectedProductImage} alt={productType} className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                          <ImageOff className="w-4 h-4 text-white/30" />
                        </div>
                      )}
                      <span className="text-white font-medium">{productType}</span>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="text-white/50 hover:text-white gap-1" onClick={clearProductSelection} disabled={isSubmitting}>
                      <Pencil className="w-3.5 h-3.5" /> تغيير
                    </Button>
                  </div>
                ) : entryMode === "manual" ? (
                  <>
                    <Input id="productType" className={inputClass} placeholder="أدخل اسم المنتج يدوياً" value={productType} onChange={(e) => setProductType(e.target.value)} disabled={isSubmitting} />
                    <button type="button" className="text-xs text-violet-400 hover:text-violet-300 hover:underline" onClick={() => { setProductType(""); setEntryMode("picker"); }}>
                      الاختيار من الكتالوج بدلاً من ذلك
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    <Button type="button" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10 gap-2" onClick={() => setShowCatalog(true)} disabled={isSubmitting}>
                      <Plus className="w-4 h-4" /> اختر من الكتالوج
                    </Button>
                    <button type="button" className="text-xs text-white/40 hover:text-white/60 hover:underline" onClick={() => setEntryMode("manual")}>
                      أو أدخل يدوياً
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="productPrice" className="text-white/70 text-sm">سعر المنتج (د.ع) *</Label>
                  <Input id="productPrice" type="number" placeholder="0" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} disabled={isSubmitting} dir="ltr" className={`text-end ${inputClass}`} />
                  <p className="text-xs text-amber-400/70">⚠ تأكد من إضافة 3 أصفار في نهاية السعر (مثال: 1000 بدلاً من 1)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity" className="text-white/70 text-sm">عدد القطع *</Label>
                  <Input id="quantity" type="number" min="1" placeholder="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={isSubmitting} dir="ltr" className={`text-end ${inputClass}`} />
                </div>
              </div>

              {productPrice && quantity && parseInt(productPrice) > 0 && parseInt(quantity) > 0 && (
                <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-3 text-center">
                  <span className="text-sm text-white/50">الإجمالي: </span>
                  <span className="text-lg font-bold text-violet-300">
                    {(parseInt(productPrice) * parseInt(quantity)).toLocaleString()} د.ع
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/70 text-sm">المحافظة *</Label>
                  <Select onValueChange={setProvince} value={province} disabled={isSubmitting}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="اختر المحافظة" /></SelectTrigger>
                    <SelectContent>
                      {IRAQ_PROVINCES.map((prov) => (<SelectItem key={prov} value={prov}>{prov}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="district" className="text-white/70 text-sm">المنطقة *</Label>
                  <Input id="district" placeholder="أدخل المنطقة" value={district} onChange={(e) => setDistrict(e.target.value)} disabled={isSubmitting} className={inputClass} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-white/70 text-sm">ملاحظات</Label>
                <Textarea id="notes" placeholder="أي ملاحظات إضافية (اختياري)" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isSubmitting} rows={3} className={inputClass} />
              </div>

              <Button type="submit" className="w-full bg-gradient-to-l from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-violet-600/30 transition-all duration-200 active:scale-[0.98]" disabled={isSubmitting}>
                {isSubmitting ? (<><Loader2 className="w-4 h-4 animate-spin ms-2" /> جاري التسجيل...</>) : ("تسجيل الطلب")}
              </Button>
            </form>
          </div>
        </div>
      </main>

      {/* Catalog Picker */}
      <Dialog open={showCatalog} onOpenChange={setShowCatalog}>
        <DialogContent className="max-w-2xl bg-[#0d1020] border-white/10 text-white max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white">اختر منتجاً من الكتالوج</DialogTitle>
          </DialogHeader>
          <div className="relative mb-2">
            <Search className="w-4 h-4 text-white/30 absolute start-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="ابحث عن منتج..."
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 ps-9"
            />
          </div>
          <div className="overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3 pb-2">
            {catalogProducts.isLoading ? (
              <p className="col-span-full text-center text-white/40 py-8">جاري التحميل...</p>
            ) : filteredCatalog.length > 0 ? (
              filteredCatalog.map((product) => (
                <div key={product.id} className="rounded-xl bg-white/[0.03] border border-white/10 p-3 flex flex-col items-center text-center gap-2">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-16 h-16 rounded-lg object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center">
                      <ImageOff className="w-6 h-6 text-white/30" />
                    </div>
                  )}
                  <p className="text-sm font-medium text-white line-clamp-2">{product.name}</p>
                  <p className="text-xs text-white/40">{product.price.toLocaleString()} د.ع</p>
                  <Button type="button" size="sm" variant="outline" className="border-violet-500/30 text-violet-300 hover:bg-violet-500/10 gap-1 w-full" onClick={() => pickProduct(product)}>
                    <Plus className="w-3.5 h-3.5" /> إضافة
                  </Button>
                </div>
              ))
            ) : (
              <p className="col-span-full text-center text-white/40 py-8">لا توجد منتجات مطابقة</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

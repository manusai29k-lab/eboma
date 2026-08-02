import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { ArrowRight, Smartphone, Loader2, Upload, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function MerchantDigital() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const merchantMe = trpc.merchant.me.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });

  const [customerPhone, setCustomerPhone] = useState("");
  const [productType, setProductType] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!merchantMe.isLoading && !merchantMe.data) {
      setLocation("/");
    }
  }, [merchantMe.isLoading, merchantMe.data, setLocation]);

  const createMutation = trpc.digitalSales.create.useMutation({
    onSuccess: () => {
      toast.success(t.merchantDigital.saleSuccess);
      setLocation("/merchant");
    },
    onError: (error) => {
      toast.error(error.message || t.merchantDigital.saleFailed);
      setIsSubmitting(false);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t.merchantDigital.imageTooLarge);
      return;
    }
    setProofImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setProofPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantMe.data) return;
    if (!customerPhone || !productType || !productPrice) {
      toast.error(t.common.fillRequiredFields);
      return;
    }
    if (!proofImage || !proofPreview) {
      toast.error(t.merchantDigital.proofRequired);
      return;
    }
    const price = parseInt(productPrice);
    if (price < 0) {
      toast.error(t.common.pricePositive);
      return;
    }
    setIsSubmitting(true);

    const proofImageBase64 = proofPreview;
    const proofImageName = proofImage.name;

    createMutation.mutate({
      merchantName: merchantMe.data.name,
      customerPhone,
      productType,
      productPrice: price,
      proofImageBase64,
      proofImageName,
    });
  };

  if (merchantMe.isLoading || !merchantMe.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060814]">
        <p className="text-white/40">{t.common.loading}</p>
      </div>
    );
  }

  const inputClass = "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-emerald-500/50 focus:bg-white/10";

  return (
    <div className="min-h-screen bg-[#060814] text-white relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-[250px] h-[250px] md:w-[400px] md:h-[400px] bg-emerald-600/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/merchant")} className="text-white/50 hover:text-white hover:bg-white/5">
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700">
              <Smartphone className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-bold text-white">{t.merchantDigital.pageTitle}</h1>
          </div>
          <LanguageSwitcher className="ms-auto" />
        </div>
      </header>

      <main className="relative z-10 container py-8 max-w-2xl">
        {/* Info Banner */}
        <div className="mb-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-emerald-300">{t.merchantDigital.infoBannerTitle}</p>
            <p className="text-xs text-white/40 mt-1">{t.merchantDigital.autoDeliveredNote(t.common.status.delivered)}</p>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/10 to-transparent rounded-3xl blur-2xl" />
          <div className="relative bg-[#0d1020]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-1">{t.merchantDigital.formTitle}</h2>
            <p className="text-sm text-white/40 mb-6">{t.merchantDigital.formSubtitle}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customerPhone" className="text-white/70 text-sm">{t.merchantDigital.customerPhoneLabel}</Label>
                <Input id="customerPhone" type="tel" placeholder={t.merchantDigital.customerPhonePlaceholder} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} disabled={isSubmitting} dir="ltr" className={`text-end ${inputClass}`} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="productType" className="text-white/70 text-sm">{t.merchantDigital.productTypeLabel}</Label>
                <Input id="productType" className={inputClass} placeholder={t.common.manualProductNamePlaceholder} value={productType} onChange={(e) => setProductType(e.target.value)} disabled={isSubmitting} />
                <p className="text-xs text-white/30">{t.common.manualProductNamePlaceholder}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="productPrice" className="text-white/70 text-sm">{t.common.priceLabel(t.common.currency)}</Label>
                <Input id="productPrice" type="number" placeholder="0" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} disabled={isSubmitting} dir="ltr" className={`text-end ${inputClass}`} />
                <p className="text-xs text-amber-400/70">{t.common.priceHint}</p>
              </div>

              {/* Proof Image Upload */}
              <div className="space-y-2">
                <Label className="text-white/70 text-sm">{t.merchantDigital.proofLabel}</Label>
                <div
                  className="border-2 border-dashed border-white/15 rounded-2xl p-6 text-center cursor-pointer hover:border-emerald-500/50 transition-colors bg-white/[0.02]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {proofPreview ? (
                    <div className="space-y-3">
                      <img src={proofPreview} alt={t.merchantDigital.proofAlt} className="max-h-48 mx-auto rounded-lg" />
                      <div className="flex items-center justify-center gap-2 text-sm text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{proofImage?.name}</span>
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="text-white/50 hover:text-white hover:bg-white/5" onClick={(e) => { e.stopPropagation(); setProofImage(null); setProofPreview(null); }}>
                        {t.merchantDigital.removeImage}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 mx-auto text-white/30" />
                      <p className="text-sm text-white/40">{t.merchantDigital.uploadPrompt}</p>
                      <p className="text-xs text-white/30">{t.merchantDigital.uploadHint}</p>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={isSubmitting} />
                </div>
              </div>

              <Button type="submit" className="w-full bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0 shadow-lg shadow-emerald-600/30 transition-all duration-200 active:scale-[0.98]" disabled={isSubmitting}>
                {isSubmitting ? (<><Loader2 className="w-4 h-4 animate-spin ms-2" /> {t.merchantDigital.submitting}</>) : (t.merchantDigital.submit)}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Trash2, Plus, KeyRound, Copy, RefreshCw, Check, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useState } from "react";

export default function AdminMerchants() {
  const [, setLocation] = useLocation();

  const merchants = trpc.merchants.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const performance = trpc.merchants.performance.useQuery(undefined, { refetchOnWindowFocus: false });

  const deleteMutation = trpc.merchants.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف التاجر");
      merchants.refetch();
      performance.refetch();
    },
    onError: () => toast.error("فشل الحذف"),
  });

  const createMutation = trpc.merchants.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء حساب التاجر بنجاح");
      merchants.refetch();
      performance.refetch();
      setShowCreateDialog(false);
      setNewName("");
      setNewUsername("");
      setNewPasscode("");
      setNewCommission("0");
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل إنشاء الحساب");
      setCreateLoading(false);
    },
  });

  const upgradeLevelMutation = trpc.merchants.upgradeLevel.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث مستوى العمولة");
      merchants.refetch();
      performance.refetch();
    },
    onError: () => toast.error("فشل تحديث المستوى"),
  });

  const resetPasswordMutation = trpc.merchants.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث كلمة السر بنجاح");
      setShowResetDialog(false);
      setResetNewPassword("");
      setResetGeneratedPassword("");
      setResetMerchantId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل تحديث كلمة السر");
      setResetLoading(false);
    },
  });

  const settleMutation = trpc.settlements.create.useMutation({
    onSuccess: () => {
      toast.success("تمت تسوية الأرباح بنجاح");
      merchants.refetch();
      performance.refetch();
      setShowSettleDialog(false);
      setSettleNote("");
      setSettleMerchantId(null);
      setSettleLoading(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "فشلت عملية التسوية");
      setSettleLoading(false);
    },
  });

  // Create merchant dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [newMerchantType, setNewMerchantType] = useState<"physical" | "digital">("physical");
  const [newCommission, setNewCommission] = useState("0");
  const [newDigitalLevel, setNewDigitalLevel] = useState<"1" | "2" | "3">("1");

  // Reset password dialog state
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetMerchantId, setResetMerchantId] = useState<number | null>(null);
  const [resetMerchantName, setResetMerchantName] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetGeneratedPassword, setResetGeneratedPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Settle earnings dialog state
  const [showSettleDialog, setShowSettleDialog] = useState(false);
  const [settleMerchantId, setSettleMerchantId] = useState<number | null>(null);
  const [settleMerchantName, setSettleMerchantName] = useState("");
  const [settleAmount, setSettleAmount] = useState(0);
  const [settleNote, setSettleNote] = useState("");
  const [settleLoading, setSettleLoading] = useState(false);

  const perfMap = new Map(performance.data?.map(p => [p.id, p]));

  const handleCreateMerchant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newUsername || !newPasscode) {
      toast.error("يرجى ملء جميع الحقول");
      return;
    }
    if (newPasscode.length < 4) {
      toast.error("كلمة السر يجب أن تكون 4 أحرف على الأقل");
      return;
    }
    setCreateLoading(true);
    createMutation.mutate({
      name: newName,
      username: newUsername,
      passcode: newPasscode,
      merchantType: newMerchantType,
      commission: newMerchantType === "physical" ? parseInt(newCommission) || 0 : 0,
      digitalLevel: newMerchantType === "digital" ? newDigitalLevel : "1",
    });
  };

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
    let password = "";
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setResetNewPassword(password);
    setResetGeneratedPassword(password);
  };

  const openResetDialog = (merchantId: number, merchantName: string) => {
    setResetMerchantId(merchantId);
    setResetMerchantName(merchantName);
    setResetNewPassword("");
    setResetGeneratedPassword("");
    setCopied(false);
    setShowResetDialog(true);
  };

  const handleResetPassword = () => {
    if (!resetMerchantId || !resetNewPassword || resetNewPassword.length < 4) {
      toast.error("كلمة السر يجب أن تكون 4 أحرف على الأقل");
      return;
    }
    setResetLoading(true);
    resetPasswordMutation.mutate({
      id: resetMerchantId,
      newPasscode: resetNewPassword,
    });
  };

  const openSettleDialog = (merchantId: number, merchantName: string, amount: number) => {
    setSettleMerchantId(merchantId);
    setSettleMerchantName(merchantName);
    setSettleAmount(amount);
    setSettleNote("");
    setShowSettleDialog(true);
  };

  const handleSettle = () => {
    if (!settleMerchantId) return;
    setSettleLoading(true);
    settleMutation.mutate({ merchantId: settleMerchantId, note: settleNote || undefined });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("تم نسخ كلمة السر");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">إدارة التجار</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إجمالي التجار: {merchants.data?.length ?? 0}
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          إضافة تاجر جديد
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            قائمة التجار
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {merchants.data && merchants.data.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>اسم المستخدم</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>العمولة</TableHead>
                    <TableHead>المستوى</TableHead>
                    <TableHead>طلبات مادية</TableHead>
                    <TableHead>مبيعات رقمية</TableHead>
                    <TableHead>إجمالي المبيعات</TableHead>
                    <TableHead>أرباح التاجر</TableHead>
                    <TableHead>ربح المدير</TableHead>
                    <TableHead>الرصيد الحالي</TableHead>
                    <TableHead>آخر دخول</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {merchants.data.map((merchant) => {
                    const perf = perfMap.get(merchant.id);
                    return (
                      <TableRow key={merchant.id}>
                        <TableCell className="font-medium">{merchant.name}</TableCell>
                        <TableCell dir="ltr">{merchant.username}</TableCell>
                        <TableCell>
                          <Badge variant={merchant.merchantType === "physical" ? "default" : "secondary"}>
                            {merchant.merchantType === "physical" ? "مادي" : "رقمي"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {merchant.merchantType === "physical"
                            ? `${merchant.commission.toLocaleString()} د.ع/طلب`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {merchant.merchantType === "digital" ? (
                            <Select
                              value={merchant.digitalLevel ?? "1"}
                              onValueChange={(val) => upgradeLevelMutation.mutate({ id: merchant.id, level: val as "1" | "2" | "3" })}
                            >
                              <SelectTrigger className="w-24 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">30%</SelectItem>
                                <SelectItem value="2">40%</SelectItem>
                                <SelectItem value="3">50%</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : "—"}
                        </TableCell>
                        <TableCell>{perf?.physicalOrders ?? 0}</TableCell>
                        <TableCell>{perf?.digitalSales ?? 0}</TableCell>
                        <TableCell className="font-semibold text-primary">
                          {(perf?.totalRevenue ?? 0).toLocaleString()} د.ع
                        </TableCell>
                        <TableCell className="font-semibold text-emerald-600">
                          {(perf?.merchantEarnings ?? 0).toLocaleString()} د.ع
                        </TableCell>
                        <TableCell className="font-semibold text-amber-600">
                          {(perf?.adminProfit ?? 0).toLocaleString()} د.ع
                        </TableCell>
                        <TableCell className="font-semibold text-teal-600">
                          {(perf?.currentBalance ?? 0).toLocaleString()} د.ع
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {merchant.lastSignedIn
                            ? new Date(merchant.lastSignedIn).toLocaleDateString("ar-IQ")
                            : "لم يدخل بعد"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {(perf?.currentBalance ?? 0) > 0 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="تسوية الأرباح"
                                onClick={() => openSettleDialog(merchant.id, merchant.name, perf?.currentBalance ?? 0)}
                              >
                                <Wallet className="w-4 h-4 text-teal-600" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              title="إعادة تعيين كلمة السر"
                              onClick={() => openResetDialog(merchant.id, merchant.name)}
                            >
                              <KeyRound className="w-4 h-4 text-amber-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="حذف"
                              onClick={() => {
                                if (confirm(`هل أنت متأكد من حذف التاجر ${merchant.name}؟ سيتم حذف جميع بياناته.`)) {
                                  deleteMutation.mutate({ id: merchant.id });
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-12">لا يوجد تجار مسجلون</p>
          )}
        </CardContent>
      </Card>

      {/* Create Merchant Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة تاجر جديد</DialogTitle>
            <DialogDescription>
              أدخل بيانات التاجر الجديد. سيتمكن التاجر من تسجيل الدخول باستخدام اسم المستخدم وكلمة السر.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateMerchant} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">اسم التاجر</Label>
              <Input
                id="new-name"
                placeholder="أدخل اسم التاجر الكامل"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-username">اسم المستخدم</Label>
              <Input
                id="new-username"
                placeholder="أدخل اسم المستخدم للدخول"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-passcode">كلمة السر</Label>
              <Input
                id="new-passcode"
                type="text"
                placeholder="أدخل كلمة السر (4 أحرف على الأقل)"
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-type">نوع التجارة</Label>
              <Select value={newMerchantType} onValueChange={(val) => setNewMerchantType(val as "physical" | "digital")}>
                <SelectTrigger id="new-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="physical">تجارة مادية</SelectItem>
                  <SelectItem value="digital">تجارة رقمية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newMerchantType === "physical" && (
              <div className="space-y-2">
                <Label htmlFor="new-commission">العمولة الثابتة لكل طلب (بالدينار العراقي)</Label>
                <Input
                  id="new-commission"
                  type="number"
                  placeholder="مثال: 1000"
                  value={newCommission}
                  onChange={(e) => setNewCommission(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">يتم خصم هذا المبلغ الثابت من كل طلب تم تسليمه كعمولة للتاجر</p>
              </div>
            )}
            {newMerchantType === "digital" && (
              <div className="space-y-2">
                <Label htmlFor="new-level">مستوى العمولة</Label>
                <Select value={newDigitalLevel} onValueChange={(val) => setNewDigitalLevel(val as "1" | "2" | "3")}>
                  <SelectTrigger id="new-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">المستوى 1 - 30%</SelectItem>
                    <SelectItem value="2">المستوى 2 - 40%</SelectItem>
                    <SelectItem value="3">المستوى 3 - 50%</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">نسبة العمولة من إجمالي المبيعات الرقمية المسلمة</p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                إلغاء
              </Button>
              <Button type="submit" disabled={createLoading}>
                {createLoading ? "جاري الإنشاء..." : "إنشاء الحساب"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إعادة تعيين كلمة السر</DialogTitle>
            <DialogDescription>
              إعادة تعيين كلمة سر التاجر: <strong>{resetMerchantName}</strong>
              <br />
              يمكنك إدخال كلمة سر يدوياً أو توليد كلمة سر عشوائية قوية.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-password">كلمة السر الجديدة</Label>
              <div className="flex gap-2">
                <Input
                  id="reset-password"
                  type="text"
                  placeholder="أدخل كلمة السر الجديدة"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  dir="ltr"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateRandomPassword}
                  title="توليد كلمة سر عشوائية"
                  className="gap-2 shrink-0"
                >
                  <RefreshCw className="w-4 h-4" />
                  توليد
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">كلمة السر يجب أن تكون 4 أحرف على الأقل</p>
            </div>

            {resetGeneratedPassword && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-amber-800">كلمة السر الجديدة:</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(resetGeneratedPassword)}
                    className="h-7 gap-1 text-amber-700"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "تم النسخ" : "نسخ"}
                  </Button>
                </div>
                <p className="text-lg font-mono font-bold text-amber-900 break-all" dir="ltr">
                  {resetGeneratedPassword}
                </p>
                <p className="text-xs text-amber-600">
                  احفظ كلمة السر هذه وشاركها مع التاجر بطريقة آمنة. لن تظهر مرة أخرى.
                </p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowResetDialog(false)}>
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={handleResetPassword}
                disabled={resetLoading || !resetNewPassword || resetNewPassword.length < 4}
                className="gap-2"
              >
                {resetLoading ? (
                  "جاري التحديث..."
                ) : (
                  <><KeyRound className="w-4 h-4" /> تحديث كلمة السر</>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settle Earnings Dialog */}
      <Dialog open={showSettleDialog} onOpenChange={setShowSettleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تسوية الأرباح</DialogTitle>
            <DialogDescription>
              تسوية أرباح التاجر: <strong>{settleMerchantName}</strong>
              <br />
              سيتم اعتبار كل الرصيد الحالي مسلّماً بالكامل، ولا يمكن التراجع عن هذه العملية.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-teal-50 border border-teal-200">
              <p className="text-sm font-semibold text-teal-800">المبلغ الذي سيتم تسليمه:</p>
              <p className="text-2xl font-bold text-teal-900">{settleAmount.toLocaleString()} د.ع</p>
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowSettleDialog(false)}>
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={handleSettle}
                disabled={settleLoading}
                className="gap-2"
              >
                {settleLoading ? "جاري التسوية..." : (<><Wallet className="w-4 h-4" /> تأكيد التسوية</>)}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

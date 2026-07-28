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
import { Users, Trash2, Plus, KeyRound, Copy, RefreshCw, Check, Wallet, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useState } from "react";

const ROLE_LABELS: Record<string, string> = {
  sales_rep: "مندوب مبيعات",
  supervisor: "تاجر مشرف",
  leader: "تاجر قائد",
  manager: "مدير التجار",
};

const NO_PARENT_VALUE = "none";

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
      setNewRole("sales_rep");
      setNewParentId(NO_PARENT_VALUE);
      setNewCommissionType("fixed");
      setNewCommissionValue("0");
      setNewOverridePercentage("0");
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل إنشاء الحساب");
      setCreateLoading(false);
    },
  });

  const updateMutation = trpc.merchants.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث بيانات التاجر بنجاح");
      merchants.refetch();
      performance.refetch();
      setShowEditDialog(false);
      setEditLoading(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل تحديث البيانات");
      setEditLoading(false);
    },
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
  const [newRole, setNewRole] = useState<"sales_rep" | "supervisor" | "leader" | "manager">("sales_rep");
  const [newParentId, setNewParentId] = useState(NO_PARENT_VALUE);
  const [newCommissionType, setNewCommissionType] = useState<"fixed" | "percentage">("fixed");
  const [newCommissionValue, setNewCommissionValue] = useState("0");
  const [newOverridePercentage, setNewOverridePercentage] = useState("0");

  // Edit merchant dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editMerchantId, setEditMerchantId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editMerchantType, setEditMerchantType] = useState<"physical" | "digital">("physical");
  const [editRole, setEditRole] = useState<"sales_rep" | "supervisor" | "leader" | "manager">("sales_rep");
  const [editParentId, setEditParentId] = useState(NO_PARENT_VALUE);
  const [editCommissionType, setEditCommissionType] = useState<"fixed" | "percentage">("fixed");
  const [editCommissionValue, setEditCommissionValue] = useState("0");
  const [editOverridePercentage, setEditOverridePercentage] = useState("0");

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
  const merchantNameMap = new Map(merchants.data?.map(m => [m.id, m.name]));

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
      role: newRole,
      parentId: newParentId === NO_PARENT_VALUE ? null : parseInt(newParentId),
      commissionType: newCommissionType,
      commissionValue: parseFloat(newCommissionValue) || 0,
      overridePercentage: newRole === "manager" ? (parseFloat(newOverridePercentage) || 0) : null,
    });
  };

  const openEditDialog = (merchant: NonNullable<typeof merchants.data>[number]) => {
    setEditMerchantId(merchant.id);
    setEditName(merchant.name);
    setEditMerchantType(merchant.merchantType);
    setEditRole(merchant.role);
    setEditParentId(merchant.parentId != null ? String(merchant.parentId) : NO_PARENT_VALUE);
    setEditCommissionType(merchant.commissionType);
    setEditCommissionValue(String(merchant.commissionValue ?? 0));
    setEditOverridePercentage(String(merchant.overridePercentage ?? 0));
    setShowEditDialog(true);
  };

  const handleUpdateMerchant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMerchantId || !editName) {
      toast.error("يرجى ملء جميع الحقول");
      return;
    }
    setEditLoading(true);
    updateMutation.mutate({
      id: editMerchantId,
      name: editName,
      merchantType: editMerchantType,
      role: editRole,
      parentId: editParentId === NO_PARENT_VALUE ? null : parseInt(editParentId),
      commissionType: editCommissionType,
      commissionValue: parseFloat(editCommissionValue) || 0,
      overridePercentage: editRole === "manager" ? (parseFloat(editOverridePercentage) || 0) : null,
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
                    <TableHead>الدور</TableHead>
                    <TableHead>يتبع لـ</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>العمولة</TableHead>
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
                        {/* الدور */}
                        <TableCell>
                          <Badge variant="outline">{ROLE_LABELS[merchant.role] ?? merchant.role}</Badge>
                        </TableCell>
                        {/* يتبع لـ */}
                        <TableCell className="text-sm text-muted-foreground">
                          {merchant.parentId != null ? (merchantNameMap.get(merchant.parentId) ?? "—") : "—"}
                        </TableCell>
                        {/* النوع */}
                        <TableCell>
                          <Badge variant={merchant.merchantType === "physical" ? "default" : "secondary"}>
                            {merchant.merchantType === "physical" ? "مادي" : "رقمي"}
                          </Badge>
                        </TableCell>
                        {/* العمولة - عمود موحّد واحد لكل من المادي والرقمي */}
                        <TableCell>
                          {merchant.commissionType === "fixed"
                            ? `${merchant.commissionValue.toLocaleString()} د.ع (ثابت)`
                            : `${merchant.commissionValue}% (نسبة)`}
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
                              title="تعديل"
                              onClick={() => openEditDialog(merchant)}
                            >
                              <Pencil className="w-4 h-4 text-primary" />
                            </Button>
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
            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor="new-role">الدور</Label>
              <Select value={newRole} onValueChange={(val) => setNewRole(val as typeof newRole)}>
                <SelectTrigger id="new-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales_rep">مندوب مبيعات</SelectItem>
                  <SelectItem value="supervisor">تاجر مشرف</SelectItem>
                  <SelectItem value="leader">تاجر قائد</SelectItem>
                  <SelectItem value="manager">مدير التجار</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-parent">يتبع لـ (اختياري)</Label>
              <Select value={newParentId} onValueChange={setNewParentId}>
                <SelectTrigger id="new-parent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT_VALUE}>بدون - على القمة</SelectItem>
                  {merchants.data?.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name} — {ROLE_LABELS[m.role] ?? m.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-commission-type">نوع العمولة</Label>
              <Select value={newCommissionType} onValueChange={(val) => setNewCommissionType(val as "fixed" | "percentage")}>
                <SelectTrigger id="new-commission-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">ثابت</SelectItem>
                  <SelectItem value="percentage">نسبة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-commission-value">
                {newCommissionType === "fixed" ? "مبلغ ثابت (د.ع)" : "نسبة مئوية من صافي الربح (%)"}
              </Label>
              <Input
                id="new-commission-value"
                type="number"
                value={newCommissionValue}
                onChange={(e) => setNewCommissionValue(e.target.value)}
              />
            </div>
            {newRole === "manager" && (
              <div className="space-y-2">
                <Label htmlFor="new-override">نسبة الحصة الإضافية (%)</Label>
                <Input
                  id="new-override"
                  type="number"
                  value={newOverridePercentage}
                  onChange={(e) => setNewOverridePercentage(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">نسبة إضافية من صافي ربح كل من تحته بالهيكل الهرمي</p>
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

      {/* Edit Merchant Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل بيانات التاجر</DialogTitle>
            <DialogDescription>
              اسم المستخدم غير قابل للتعديل هنا. لتغيير كلمة السر استخدم زر إعادة التعيين.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateMerchant} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">اسم التاجر</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">نوع التجارة</Label>
              <Select value={editMerchantType} onValueChange={(val) => setEditMerchantType(val as "physical" | "digital")}>
                <SelectTrigger id="edit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="physical">تجارة مادية</SelectItem>
                  <SelectItem value="digital">تجارة رقمية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor="edit-role">الدور</Label>
              <Select value={editRole} onValueChange={(val) => setEditRole(val as typeof editRole)}>
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales_rep">مندوب مبيعات</SelectItem>
                  <SelectItem value="supervisor">تاجر مشرف</SelectItem>
                  <SelectItem value="leader">تاجر قائد</SelectItem>
                  <SelectItem value="manager">مدير التجار</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-parent">يتبع لـ (اختياري)</Label>
              <Select value={editParentId} onValueChange={setEditParentId}>
                <SelectTrigger id="edit-parent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT_VALUE}>بدون - على القمة</SelectItem>
                  {merchants.data?.filter((m) => m.id !== editMerchantId).map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name} — {ROLE_LABELS[m.role] ?? m.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-commission-type">نوع العمولة</Label>
              <Select value={editCommissionType} onValueChange={(val) => setEditCommissionType(val as "fixed" | "percentage")}>
                <SelectTrigger id="edit-commission-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">ثابت</SelectItem>
                  <SelectItem value="percentage">نسبة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-commission-value">
                {editCommissionType === "fixed" ? "مبلغ ثابت (د.ع)" : "نسبة مئوية من صافي الربح (%)"}
              </Label>
              <Input
                id="edit-commission-value"
                type="number"
                value={editCommissionValue}
                onChange={(e) => setEditCommissionValue(e.target.value)}
              />
            </div>
            {editRole === "manager" && (
              <div className="space-y-2">
                <Label htmlFor="edit-override">نسبة الحصة الإضافية (%)</Label>
                <Input
                  id="edit-override"
                  type="number"
                  value={editOverridePercentage}
                  onChange={(e) => setEditOverridePercentage(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">نسبة إضافية من صافي ربح كل من تحته بالهيكل الهرمي</p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                إلغاء
              </Button>
              <Button type="submit" disabled={editLoading}>
                {editLoading ? "جاري الحفظ..." : "حفظ التعديلات"}
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

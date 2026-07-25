import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Smartphone, Users, TrendingUp, ShoppingCart, DollarSign, RotateCcw, XCircle, Wallet } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar,
} from "recharts";
import { useLocation } from "wouter";


export default function AdminDashboard() {
  const adminMe = trpc.admin.me.useQuery(undefined, { refetchOnWindowFocus: false, retry: false });
  const [, setLocation] = useLocation();

  const stats = trpc.dashboard.stats.useQuery(undefined, { refetchOnWindowFocus: false });
  const dailySales = trpc.dashboard.dailySales.useQuery({ days: 30 }, { refetchOnWindowFocus: false });
  const merchantPerf = trpc.merchants.performance.useQuery(undefined, { refetchOnWindowFocus: false });

  if (adminMe.isLoading || !adminMe.data) {
    return <div className="min-h-screen flex items-center justify-center"><p>جاري التحميل...</p></div>;
  }

  const statCards = [
    { label: "إجمالي الطلبات المادية", value: stats.data?.totalPhysicalOrders ?? 0, icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "إجمالي المبيعات الرقمية", value: stats.data?.totalDigitalSales ?? 0, icon: Smartphone, color: "text-green-600", bg: "bg-green-50" },
    { label: "إجمالي المبيعات (د.ع)", value: (stats.data?.totalRevenue ?? 0).toLocaleString(), icon: DollarSign, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "عدد التجار", value: stats.data?.totalMerchants ?? 0, icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  const profitCards = [
    { label: "أرباح المدير (د.ع)", value: (stats.data?.totalAdminProfit ?? 0).toLocaleString(), icon: Wallet, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "عمولات التجار (د.ع)", value: (stats.data?.totalMerchantEarnings ?? 0).toLocaleString(), icon: DollarSign, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "طلبات مرتجعة", value: stats.data?.returnedOrders ?? 0, icon: RotateCcw, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "طلبات ملغاة", value: stats.data?.cancelledOrders ?? 0, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">لوحة التحكم الإدارية</h1>
        <p className="text-sm text-muted-foreground mt-1">
          مرحباً {adminMe.data.name || "IBRAHIM WALEED"} - نظرة عامة على أداء النظام
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <Card key={i} className="shadow-sm">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Profit & Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {profitCards.map((stat, i) => (
          <Card key={i} className="shadow-sm">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue Chart */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              المبيعات اليومية (آخر 30 يوم)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailySales.data ?? []}>
                <defs>
                  <linearGradient id="colorPhys" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorDigi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="physicalRevenue" name="مبيعات مادية" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPhys)" />
                <Area type="monotone" dataKey="digitalRevenue" name="مبيعات رقمية" stroke="#22c55e" fillOpacity={1} fill="url(#colorDigi)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Orders Count Chart */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              عدد الطلبات اليومية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailySales.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="physicalOrders" name="طلبات مادية" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="digitalSales" name="مبيعات رقمية" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Merchants */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            أداء التجار
          </CardTitle>
        </CardHeader>
        <CardContent>
          {merchantPerf.data && merchantPerf.data.length > 0 ? (
            <div className="space-y-3">
              {merchantPerf.data
                .sort((a, b) => b.totalOrders - a.totalOrders)
                .slice(0, 5)
                .map((merchant) => (
                  <div key={merchant.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-semibold">
                        {merchant.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{merchant.name}</p>
                        <p className="text-xs text-muted-foreground" dir="ltr">{merchant.username}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-sm font-semibold">{merchant.physicalOrders}</p>
                        <p className="text-xs text-muted-foreground">مادية</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold">{merchant.digitalSales}</p>
                        <p className="text-xs text-muted-foreground">رقمية</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-primary">{merchant.totalRevenue.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">د.ع</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-emerald-600">{merchant.merchantEarnings.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">عمولة</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">لا يوجد تجار بعد</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

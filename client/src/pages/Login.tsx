import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Loader2, Package, User,
} from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [location, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPasscode, setLoginPasscode] = useState("");
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // Redirect admin if already logged in via Manus OAuth
  useEffect(() => {
    if (!loading && user) {
      setLocation("/admin");
    }
  }, [user, loading, setLocation]);

  const merchantMe = trpc.merchant.me.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (merchantMe.data) {
      setLocation("/merchant");
    }
  }, [merchantMe.data, setLocation]);

  const loginMutation = trpc.merchant.login.useMutation({
    onSuccess: (data) => {
      toast.success(`مرحباً ${data.name}`);
      setLocation("/merchant");
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل تسجيل الدخول");
      setIsLoginLoading(false);
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername || !loginPasscode) {
      toast.error("يرجى ملء جميع الحقول");
      return;
    }
    setIsLoginLoading(true);
    loginMutation.mutate({ username: loginUsername, passcode: loginPasscode });
  };

  return (
    <div className="min-h-screen bg-[#060814] text-white relative overflow-hidden flex flex-col">
      {/* Background glow effects */}
      <div className="absolute top-0 right-1/4 w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-violet-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[250px] h-[250px] md:w-[400px] md:h-[400px] bg-emerald-600/15 rounded-full blur-[100px] pointer-events-none" />

      {/* Navigation Bar */}
      <header className="relative z-10 border-b border-white/5">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 shadow-lg shadow-violet-500/30">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white leading-none">EBOMA</h1>
              <p className="text-[10px] text-white/40 mt-0.5">نظام إدارة الطلبات</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Centered Login Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Glow behind card */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 to-emerald-600/10 rounded-3xl blur-2xl pointer-events-none" />

          <div className="relative bg-[#0d1020]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 shadow-lg shadow-violet-500/30 mb-4">
                <Package className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">نظام إدارة الطلبات - EBOMA</h2>
              <p className="text-sm text-white/50 mt-2">سجّل دخولك لإدارة طلباتك ومتابعة مبيعاتك</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="login-username" className="text-white/70 text-sm">اسم المستخدم</Label>
                <Input
                  id="login-username"
                  type="text"
                  placeholder="أدخل اسم المستخدم"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  disabled={isLoginLoading}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-violet-500/50 focus:bg-white/10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-passcode" className="text-white/70 text-sm">كلمة السر</Label>
                <Input
                  id="login-passcode"
                  type="password"
                  placeholder="أدخل كلمة السر"
                  value={loginPasscode}
                  onChange={(e) => setLoginPasscode(e.target.value)}
                  disabled={isLoginLoading}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-violet-500/50 focus:bg-white/10"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-l from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-violet-600/30 transition-all duration-200 active:scale-[0.98]"
                disabled={isLoginLoading}
              >
                {isLoginLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin ms-2" /> جاري التحقق...</>
                ) : (
                  <><User className="w-4 h-4 ms-2" /> دخول</>
                )}
              </Button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-6">
        <div className="container text-center">
          <p className="text-sm text-white/30">
            EBOMA © 2026 - جميع الحقوق محفوظة - المؤسس والمدير IBRAHIM WALEED
          </p>
        </div>
      </footer>
    </div>
  );
}

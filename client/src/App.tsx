import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import MerchantDashboard from "./pages/MerchantDashboard";
import MerchantPhysical from "./pages/MerchantPhysical";
import MerchantDigital from "./pages/MerchantDigital";
import MerchantOrders from "./pages/MerchantOrders";
import MerchantEarnings from "./pages/MerchantEarnings";
import MerchantTeam from "./pages/MerchantTeam";
import AdminDashboard from "./pages/AdminDashboard";
import AdminOrders from "./pages/AdminOrders";
import AdminProducts from "./pages/AdminProducts";
import AdminMerchants from "./pages/AdminMerchants";
import AdminReports from "./pages/AdminReports";
import AdminProductProfitReport from "./pages/AdminProductProfitReport";
import AdminSettlements from "./pages/AdminSettlements";
import AdminOrgTree from "./pages/AdminOrgTree";
import AdminProfitSettlements from "./pages/AdminProfitSettlements";
import AdminLayout from "./pages/admin/AdminLayout";

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/" component={Login} />

      {/* Hidden Admin Login Route - no public link, accessed by typing URL directly */}
      <Route path="/admin-login" component={AdminLogin} />

      {/* Merchant Routes */}
      <Route path="/merchant" component={MerchantDashboard} />
      <Route path="/merchant/physical" component={MerchantPhysical} />
      <Route path="/merchant/digital" component={MerchantDigital} />
      <Route path="/merchant/orders" component={MerchantOrders} />
      <Route path="/merchant/earnings" component={MerchantEarnings} />
      <Route path="/merchant/team" component={MerchantTeam} />

      {/* Admin Routes - wrapped in AdminLayout */}
      <Route path="/admin" nest>
        <AdminLayout>
          <Switch>
            <Route path="/" component={AdminDashboard} />
            <Route path="/orders" component={AdminOrders} />
            <Route path="/products" component={AdminProducts} />
            <Route path="/merchants" component={AdminMerchants} />
            <Route path="/reports" component={AdminReports} />
            <Route path="/product-profit" component={AdminProductProfitReport} />
            <Route path="/settlements" component={AdminSettlements} />
            <Route path="/org-tree" component={AdminOrgTree} />
            <Route path="/profit-settlements" component={AdminProfitSettlements} />
          </Switch>
        </AdminLayout>
      </Route>

      {/* 404 */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <LanguageProvider>
          <TooltipProvider>
            <Toaster position="top-center" richColors />
            <Router />
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

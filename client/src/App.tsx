import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { CredentialsProvider } from "@/contexts/credentials-context";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { Header } from "@/components/header";
import Dashboard from "@/pages/dashboard";
import Settings from "@/pages/settings";
import Inventory from "@/pages/inventory";
import StockLedger from "@/pages/stock-ledger";
import PurchaseOrders from "@/pages/purchase-orders";
import Suppliers from "@/pages/suppliers";
import Customers from "@/pages/customers";
import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/" component={DashboardWithHeader} />
      <ProtectedRoute path="/settings" component={SettingsWithHeader} />
      <ProtectedRoute path="/inventory" component={InventoryWithHeader} />
      <ProtectedRoute path="/stock-ledger" component={StockLedgerWithHeader} />
      <ProtectedRoute path="/purchase-orders" component={PurchaseOrdersWithHeader} />
      <ProtectedRoute path="/suppliers" component={SuppliersWithHeader} />
      <ProtectedRoute path="/customers" component={CustomersWithHeader} />
      <Route component={NotFound} />
    </Switch>
  );
}

function DashboardWithHeader() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Dashboard />
    </div>
  );
}

function SettingsWithHeader() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Settings />
    </div>
  );
}

function InventoryWithHeader() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Inventory />
    </div>
  );
}

function StockLedgerWithHeader() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <StockLedger />
    </div>
  );
}

function PurchaseOrdersWithHeader() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <PurchaseOrders />
    </div>
  );
}

function SuppliersWithHeader() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Suppliers />
    </div>
  );
}

function CustomersWithHeader() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Customers />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CredentialsProvider>
          <ThemeProvider defaultTheme="light">
            <TooltipProvider>
              <Router />
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </CredentialsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

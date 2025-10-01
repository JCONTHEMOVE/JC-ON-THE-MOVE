import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { WalletProviderWrapper } from "@/components/WalletProviderWrapper";
import Header from "@/components/header";
import Footer from "@/components/footer";
import HomePage from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import RewardsPage from "@/pages/rewards";
import FaucetPage from "@/pages/faucet";
import TreasuryDashboard from "@/pages/treasury-dashboard";
import AdminDashboardFull from "@/pages/admin-dashboard-full";
import AdminMoonshotPage from "@/pages/admin-moonshot";
import NotFound from "@/pages/not-found";
import MobileLeadManager from "@/components/mobile-lead-manager";
import CustomerMobileInterface from "@/components/customer-mobile-interface";
import { ShopCatalogPage } from "@/pages/shop-catalog";
import { CreateShopItemPage } from "@/pages/create-shop-item";

// Landing page for unauthenticated users
function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Header />
      <main>
        <HomePage />
      </main>
      <Footer />
    </div>
  );
}

// Wrapper for legacy desktop pages that need Header
function DesktopPageWrapper({ component: Component }: { component: any }) {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Header />
      <main>
        <Component />
      </main>
    </div>
  );
}

// Main app for authenticated users - Mobile-first interface
function AuthenticatedApp() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Switch>
        {/* Mobile-first routing - primary interface for all users */}
        <Route path="/" component={MobileLeadManager} />
        <Route path="/mobile" component={MobileLeadManager} />
        
        {/* Desktop/legacy routes for backwards compatibility */}
        <Route path="/dashboard">
          <DesktopPageWrapper component={Dashboard} />
        </Route>
        <Route path="/rewards">
          <DesktopPageWrapper component={RewardsPage} />
        </Route>
        <Route path="/faucet">
          <DesktopPageWrapper component={FaucetPage} />
        </Route>
        <Route path="/treasury">
          <DesktopPageWrapper component={TreasuryDashboard} />
        </Route>
        <Route path="/admin">
          <AdminDashboardFull />
        </Route>
        <Route path="/admin-moonshot">
          <DesktopPageWrapper component={AdminMoonshotPage} />
        </Route>
        <Route path="/shop">
          <DesktopPageWrapper component={ShopCatalogPage} />
        </Route>
        <Route path="/shop/create">
          <DesktopPageWrapper component={CreateShopItemPage} />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Customer interface - accessible to all users without authentication */}
      <Route path="/customer" component={CustomerMobileInterface} />
      
      {/* Authenticated vs unauthenticated routing */}
      <Route>
        {isAuthenticated ? <AuthenticatedApp /> : <LandingPage />}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProviderWrapper>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </WalletProviderWrapper>
    </QueryClientProvider>
  );
}

export default App;

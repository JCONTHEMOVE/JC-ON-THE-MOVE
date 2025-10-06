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
import EmployeeHomePage from "@/pages/employee-home";
import CustomerPortal from "@/pages/customer-portal";
import TreasuryDashboard from "@/pages/treasury-dashboard";
import AdminDashboardFull from "@/pages/admin-dashboard-full";
import AdminMoonshotPage from "@/pages/admin-moonshot";
import NotFound from "@/pages/not-found";
import MobileLeadManager from "@/components/mobile-lead-manager";
import CustomerMobileInterface from "@/components/customer-mobile-interface";
import { ShopCatalogPage } from "@/pages/shop-catalog";
import { CreateShopItemPage } from "@/pages/create-shop-item";
import { ShopItemDetailPage } from "@/pages/shop-item-detail";

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

// Unified page wrapper with responsive header
function PageWrapper({ component: Component }: { component: any }) {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Header />
      <main>
        <Component />
      </main>
    </div>
  );
}

// Main app for authenticated users - Unified routing for all devices
function AuthenticatedApp() {
  const { user } = useAuth();
  
  // Determine home page based on user role
  const HomePage = user?.role === 'customer' ? CustomerPortal : EmployeeHomePage;
  
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Switch>
        {/* Primary routes - accessible on all devices */}
        <Route path="/">
          <PageWrapper component={HomePage} />
        </Route>
        <Route path="/dashboard">
          <PageWrapper component={Dashboard} />
        </Route>
        <Route path="/rewards">
          <PageWrapper component={RewardsPage} />
        </Route>
        <Route path="/treasury">
          <PageWrapper component={TreasuryDashboard} />
        </Route>
        
        {/* Job management interface */}
        <Route path="/jobs" component={MobileLeadManager} />
        
        {/* Shop routes */}
        <Route path="/shop">
          <PageWrapper component={ShopCatalogPage} />
        </Route>
        <Route path="/shop/create">
          <PageWrapper component={CreateShopItemPage} />
        </Route>
        <Route path="/shop/:id">
          <ShopItemDetailPage />
        </Route>
        
        {/* Admin routes */}
        <Route path="/admin">
          <AdminDashboardFull />
        </Route>
        <Route path="/admin-moonshot">
          <PageWrapper component={AdminMoonshotPage} />
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

import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { WalletProviderWrapper } from "@/components/WalletProviderWrapper";
import { RouteGuard } from "@/components/RouteGuard";
import { ComplianceCheck } from "@/components/compliance-check";
import Header from "@/components/header";
import Footer from "@/components/footer";
import HomePage from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import RewardsPage from "@/pages/rewards";
import ProfilePage from "@/pages/profile";
import EmployeeHomePage from "@/pages/employee-home";
import EmployeeAddJob from "@/pages/employee-add-job";
import CustomerPortal from "@/pages/customer-portal";
import PendingApprovalPage from "@/pages/pending-approval";
import TreasuryDashboard from "@/pages/treasury-dashboard";
import AdminDashboardFull from "@/pages/admin-dashboard-full";
import AdminMoonshotPage from "@/pages/admin-moonshot";
import NotFound from "@/pages/not-found";
import MobileLeadManager from "@/components/mobile-lead-manager";
import CustomerMobileInterface from "@/components/customer-mobile-interface";
import { ShopCatalogPage } from "@/pages/shop-catalog";
import { CreateShopItemPage } from "@/pages/create-shop-item";
import { ShopItemDetailPage } from "@/pages/shop-item-detail";
import JobDetailPage from "@/pages/job-detail";
import TermsOfService from "@/pages/terms";
import MiningPage from "@/pages/mining";

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
    <ComplianceCheck>
      <div className="min-h-screen bg-background text-foreground font-sans">
        <Switch>
          {/* Primary routes - accessible on all devices */}
          <Route path="/">
            <PageWrapper component={HomePage} />
          </Route>
          <Route path="/dashboard">
            <RouteGuard allowedRoles={['admin', 'employee']}>
              <PageWrapper component={Dashboard} />
            </RouteGuard>
          </Route>
          <Route path="/employee/add-job">
            <RouteGuard allowedRoles={['admin', 'employee']}>
              <EmployeeAddJob />
            </RouteGuard>
          </Route>
          <Route path="/rewards">
            <PageWrapper component={RewardsPage} />
          </Route>
          <Route path="/mining">
            <PageWrapper component={MiningPage} />
          </Route>
          <Route path="/profile">
            <PageWrapper component={ProfilePage} />
          </Route>
          <Route path="/pending-approval">
            <PendingApprovalPage />
          </Route>
          <Route path="/treasury">
            <RouteGuard allowedRoles={['admin']}>
              <PageWrapper component={TreasuryDashboard} />
            </RouteGuard>
          </Route>
          
          {/* Job management interface */}
          <Route path="/jobs">
            <RouteGuard allowedRoles={['admin', 'employee']}>
              <MobileLeadManager />
            </RouteGuard>
          </Route>
          
          {/* Shop routes */}
          <Route path="/shop">
            <PageWrapper component={ShopCatalogPage} />
          </Route>
          <Route path="/shop/create">
            <RouteGuard allowedRoles={['admin', 'employee']}>
              <PageWrapper component={CreateShopItemPage} />
            </RouteGuard>
          </Route>
          <Route path="/shop/:id">
            <ShopItemDetailPage />
          </Route>
          
          {/* Admin routes */}
          <Route path="/admin">
            <RouteGuard allowedRoles={['admin']}>
              <AdminDashboardFull />
            </RouteGuard>
          </Route>
          <Route path="/admin-moonshot">
            <RouteGuard allowedRoles={['admin']}>
              <PageWrapper component={AdminMoonshotPage} />
            </RouteGuard>
          </Route>
          
          {/* Job detail route */}
          <Route path="/job/:id">
            <RouteGuard allowedRoles={['admin']}>
              <JobDetailPage />
            </RouteGuard>
          </Route>
          
          <Route component={NotFound} />
        </Switch>
      </div>
    </ComplianceCheck>
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
      
      {/* Terms of Service - accessible to all */}
      <Route path="/terms" component={TermsOfService} />
      
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

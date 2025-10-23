import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { Menu, X, User, LogOut } from "lucide-react";

export default function Header() {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, hasAdminAccess, isLoading } = useAuth();

  const scrollToSection = (sectionId: string) => {
    if (location === "/") {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      window.location.href = `/#${sectionId}`;
    }
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-background shadow-sm border-b border-border sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" data-testid="link-home">
              <h1 className="text-2xl font-bold text-primary">JC ON THE MOVE</h1>
            </Link>
          </div>
          
          {!isMobile ? (
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {isAuthenticated ? (
                  // Navigation for authenticated users (role-based)
                  <>
                    <Link
                      href="/"
                      className="text-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors"
                      data-testid="button-home"
                    >
                      {user?.role === 'customer' ? 'My Portal' : 'Dashboard'}
                    </Link>
                    
                    {/* Customer-specific navigation */}
                    {user?.role === 'customer' && (
                      <>
                        <Link
                          href="/shop"
                          className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors"
                          data-testid="button-shop"
                        >
                          Shop
                        </Link>
                        <Link
                          href="/rewards"
                          className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors"
                          data-testid="button-rewards"
                        >
                          Rewards
                        </Link>
                      </>
                    )}
                    
                    {/* Employee/Admin navigation */}
                    {(user?.role === 'employee' || user?.role === 'admin') && (
                      <>
                        <Link
                          href="/dashboard"
                          className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors"
                          data-testid="button-dashboard"
                        >
                          Jobs
                        </Link>
                        <Link
                          href="/rewards"
                          className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors"
                          data-testid="button-rewards"
                        >
                          Rewards
                        </Link>
                        <Link
                          href="/shop"
                          className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors"
                          data-testid="button-shop"
                        >
                          Shop
                        </Link>
                      </>
                    )}
                    
                    {/* Admin-only navigation */}
                    {hasAdminAccess && (
                      <Link
                        href="/in-god-we-trust"
                        className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent px-3 py-2 rounded-md text-sm font-bold transition-colors hover:from-blue-700 hover:to-purple-700"
                        data-testid="button-in-god-we-trust"
                      >
                        IN GOD WE TRUST
                      </Link>
                    )}
                    
                    <a
                      href="/#home"
                      className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors"
                      data-testid="button-view-public"
                    >
                      View Public Site
                    </a>
                  </>
                ) : (
                  // Navigation for unauthenticated users (landing page)
                  <>
                    <button
                      onClick={() => scrollToSection("home")}
                      className="text-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors"
                      data-testid="button-home"
                    >
                      Home
                    </button>
                    <button
                      onClick={() => scrollToSection("services")}
                      className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors"
                      data-testid="button-services"
                    >
                      Services
                    </button>
                    <button
                      onClick={() => scrollToSection("gallery")}
                      className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors"
                      data-testid="button-gallery"
                    >
                      Gallery
                    </button>
                    <button
                      onClick={() => scrollToSection("quote")}
                      className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors"
                      data-testid="button-quote"
                    >
                      Get Quote
                    </button>
                  </>
                )}
                
                {isAuthenticated ? (
                  <div className="flex items-center space-x-4">
                    <Link
                      href="/profile"
                      className="flex items-center space-x-2 text-sm hover:text-primary transition-colors cursor-pointer"
                      data-testid="link-profile"
                    >
                      {user?.profileImageUrl ? (
                        <img 
                          src={user.profileImageUrl} 
                          alt="Profile" 
                          className="w-6 h-6 rounded-full object-cover"
                          data-testid="img-profile-avatar"
                        />
                      ) : (
                        <User className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="text-muted-foreground">
                        {user?.username || user?.firstName || user?.email || 'User'}
                      </span>
                    </Link>
                    <a 
                      href="/api/logout" 
                      className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors"
                      data-testid="button-logout"
                    >
                      <LogOut className="h-4 w-4 inline mr-1" />
                      Logout
                    </a>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <a 
                      href="/api/login?role=customer" 
                      className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors"
                      data-testid="button-customer-login"
                    >
                      Customer Portal
                    </a>
                    <a 
                      href="/api/login?role=employee" 
                      className="bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                      data-testid="button-employee-login"
                    >
                      Employee Portal
                    </a>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="button-mobile-menu"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          )}
        </div>
        
        {isMobile && mobileMenuOpen && (
          <div className="md:hidden border-t border-border py-4">
            <div className="flex flex-col space-y-2">
              {isAuthenticated ? (
                // Mobile navigation for authenticated users (role-based)
                <>
                  <Link
                    href="/"
                    className="text-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors text-left"
                    data-testid="button-mobile-home"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {user?.role === 'customer' ? 'My Portal' : 'Dashboard'}
                  </Link>
                  
                  {/* Customer-specific mobile navigation */}
                  {user?.role === 'customer' && (
                    <>
                      <Link
                        href="/shop"
                        className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors text-left"
                        data-testid="button-mobile-shop"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Shop
                      </Link>
                      <Link
                        href="/rewards"
                        className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors text-left"
                        data-testid="button-mobile-rewards"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Rewards
                      </Link>
                    </>
                  )}
                  
                  {/* Employee/Admin mobile navigation */}
                  {(user?.role === 'employee' || user?.role === 'admin') && (
                    <>
                      <Link
                        href="/dashboard"
                        className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors text-left"
                        data-testid="button-mobile-dashboard"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Jobs
                      </Link>
                      <Link
                        href="/rewards"
                        className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors text-left"
                        data-testid="button-mobile-rewards"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Rewards
                      </Link>
                      <Link
                        href="/shop"
                        className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors text-left"
                        data-testid="button-mobile-shop"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Shop
                      </Link>
                    </>
                  )}
                  
                  {/* Admin-only mobile navigation */}
                  {hasAdminAccess && (
                    <Link
                      href="/in-god-we-trust"
                      className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent px-3 py-2 rounded-md text-sm font-bold transition-colors text-left"
                      data-testid="button-mobile-in-god-we-trust"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      IN GOD WE TRUST
                    </Link>
                  )}
                  
                  <a
                    href="/#home"
                    className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors text-left"
                    data-testid="button-mobile-view-public"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    View Public Site
                  </a>
                </>
              ) : (
                // Mobile navigation for unauthenticated users (landing page)
                <>
                  <button
                    onClick={() => scrollToSection("home")}
                    className="text-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors text-left"
                    data-testid="button-mobile-home"
                  >
                    Home
                  </button>
                  <button
                    onClick={() => scrollToSection("services")}
                    className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors text-left"
                    data-testid="button-mobile-services"
                  >
                    Services
                  </button>
                  <button
                    onClick={() => scrollToSection("gallery")}
                    className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors text-left"
                    data-testid="button-mobile-gallery"
                  >
                    Gallery
                  </button>
                  <button
                    onClick={() => scrollToSection("quote")}
                    className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors text-left"
                    data-testid="button-mobile-quote"
                  >
                    Get Quote
                  </button>
                </>
              )}
              
              {isAuthenticated ? (
                <>
                  <Link
                    href="/profile"
                    className="flex items-center space-x-2 px-3 py-2 text-sm hover:text-primary transition-colors cursor-pointer"
                    data-testid="link-mobile-profile"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {user?.profileImageUrl ? (
                      <img 
                        src={user.profileImageUrl} 
                        alt="Profile" 
                        className="w-6 h-6 rounded-full object-cover"
                        data-testid="img-mobile-profile-avatar"
                      />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="text-muted-foreground">
                      {user?.username || user?.firstName || user?.email || 'User'}
                    </span>
                  </Link>
                  <a 
                    href="/api/logout" 
                    className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors text-left"
                    data-testid="button-mobile-logout"
                  >
                    <LogOut className="h-4 w-4 inline mr-1" />
                    Logout
                  </a>
                </>
              ) : (
                <div className="flex flex-col space-y-2">
                  <a 
                    href="/api/login?role=customer" 
                    className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors text-left"
                    data-testid="button-mobile-customer-login"
                  >
                    Customer Portal
                  </a>
                  <a 
                    href="/api/login?role=employee" 
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left"
                    data-testid="button-mobile-employee-login"
                  >
                    Employee Portal
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

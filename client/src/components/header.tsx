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
  const { user, isAuthenticated, isLoading } = useAuth();

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
                {!isAuthenticated && (
                  <button
                    onClick={() => scrollToSection("quote")}
                    className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    data-testid="button-quote"
                  >
                    Get Quote
                  </button>
                )}
                
                {isAuthenticated ? (
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 text-sm">
                      {user?.profileImageUrl ? (
                        <img 
                          src={user.profileImageUrl} 
                          alt="Profile" 
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <User className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="text-muted-foreground">
                        {user?.firstName || user?.email || 'User'}
                      </span>
                    </div>
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
                  <a 
                    href="/api/login" 
                    className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    data-testid="button-login"
                  >
                    Login
                  </a>
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
              {!isAuthenticated && (
                <button
                  onClick={() => scrollToSection("quote")}
                  className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors text-left"
                  data-testid="button-mobile-quote"
                >
                  Get Quote
                </button>
              )}
              
              {isAuthenticated ? (
                <>
                  <div className="flex items-center space-x-2 px-3 py-2 text-sm">
                    {user?.profileImageUrl ? (
                      <img 
                        src={user.profileImageUrl} 
                        alt="Profile" 
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="text-muted-foreground">
                      {user?.firstName || user?.email || 'User'}
                    </span>
                  </div>
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
                <a 
                  href="/api/login" 
                  className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors text-left"
                  data-testid="button-mobile-login"
                >
                  Login
                </a>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

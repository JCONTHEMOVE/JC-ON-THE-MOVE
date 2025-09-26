import { useQuery } from "@tanstack/react-query";
import { type User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    refetchInterval: 30000, // Refetch every 30 seconds instead of constant polling
    queryFn: async () => {
      try {
        const response = await fetch("/api/auth/user", { 
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        if (response.status === 401) {
          // 401 is expected for unauthenticated users - return null instead of throwing
          return null;
        }
        if (!response.ok) {
          console.error(`Authentication check failed: ${response.status}`);
          throw new Error(`Authentication check failed: ${response.status}`);
        }
        const userData = await response.json();
        console.log('Authentication successful, user:', userData?.email);
        return userData;
      } catch (error) {
        console.error('Auth fetch error:', error);
        throw error;
      }
    },
  });

  // Helper function to check if user has admin level permissions
  const hasAdminAccess = user?.role === 'admin' || user?.role === 'business_owner';
  
  // Debug logging to track auth issues
  if (user) {
    console.log('Auth Debug - user role:', user.role);
    console.log('Auth Debug - hasAdminAccess:', hasAdminAccess);
    console.log('Auth Debug - canAccessTreasury:', hasAdminAccess);
  }
  
  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isEmployee: user?.role === 'employee',
    isAdmin: user?.role === 'admin',
    isCustomer: user?.role === 'customer',
    // Treasury access for both admin and business_owner roles
    hasAdminAccess,
    hasManagementAccess: hasAdminAccess,
    canManageInvitations: hasAdminAccess,
    canAccessTreasury: hasAdminAccess, // Both admin and business_owner can access treasury
    canViewAllLeads: hasAdminAccess,
  };
}
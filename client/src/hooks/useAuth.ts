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
  
  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isEmployee: user?.role === 'employee',
    isAdmin: user?.role === 'admin',
    isCustomer: user?.role === 'customer',
    // Admin permission checks - only admin role has these privileges
    hasAdminAccess, // Only admin has this
    hasManagementAccess: hasAdminAccess, // Alias for clarity
    canManageInvitations: hasAdminAccess, // Only admin can manage invitations
    canAccessTreasury: hasAdminAccess, // Only admin can access treasury
    canViewAllLeads: hasAdminAccess, // Only admin can view all leads
  };
}
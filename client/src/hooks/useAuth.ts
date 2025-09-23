import { useQuery } from "@tanstack/react-query";
import { type User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    queryFn: async () => {
      const response = await fetch("/api/auth/user");
      if (response.status === 401) {
        // 401 is expected for unauthenticated users - return null instead of throwing
        return null;
      }
      if (!response.ok) {
        throw new Error(`Authentication check failed: ${response.status}`);
      }
      return response.json();
    },
  });

  // Helper function to check if user has admin/business owner level permissions
  const hasAdminAccess = user?.role === 'admin' || user?.role === 'business_owner';
  
  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isBusinessOwner: user?.role === 'business_owner',
    isEmployee: user?.role === 'employee',
    isAdmin: user?.role === 'admin',
    // New unified permission checks - admin and business_owner have equivalent access
    hasAdminAccess, // Both admin and business_owner have this
    hasManagementAccess: hasAdminAccess, // Alias for clarity
    canManageInvitations: hasAdminAccess, // Both can manage invitations
    canAccessTreasury: hasAdminAccess, // Both can access treasury
    canViewAllLeads: hasAdminAccess, // Both can view all leads
  };
}
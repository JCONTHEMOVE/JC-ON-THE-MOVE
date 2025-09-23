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

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isBusinessOwner: user?.role === 'business_owner',
    isEmployee: user?.role === 'employee',
    isAdmin: user?.role === 'admin',
  };
}
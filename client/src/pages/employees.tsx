import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { type User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Mail, Users, Trash2 } from "lucide-react";

type PayoutClassification = "lead_mover" | "mover" | "helper";
type EmployeeWithPayout = User & {
  payoutProfile?: {
    authorityTier?: string | null;
    payoutClassification?: PayoutClassification | null;
    defaultBonusWeight?: string | null;
  };
};

export default function EmployeesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userToDelete, setUserToDelete] = useState<EmployeeWithPayout | null>(null);

  const { data: employees = [], isLoading } = useQuery<EmployeeWithPayout[]>({
    queryKey: ["/api/employees"],
  });

  const updatePayoutProfileMutation = useMutation({
    mutationFn: async ({ id, payoutClassification }: { id: string; payoutClassification: PayoutClassification }) => {
      const response = await apiRequest("PATCH", `/api/employees/${id}/payout-profile`, { payoutClassification });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Payout classification updated" });
    },
    onError: (error: Error) => toast({ title: "Payout profile failed", description: error.message, variant: "destructive" }),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const response = await apiRequest("PATCH", `/api/users/${id}/role`, { role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Role updated",
        description: "Employee role has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update role. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/users/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: "The user has been permanently deleted.",
      });
      setUserToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
          <p className="mt-4 text-slate-400">Loading employees...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-purple-400" />
              <div>
                <h1 className="text-3xl font-bold text-white">Employee Management</h1>
                <p className="text-slate-400 mt-1">Manage permissions and default payout classifications</p>
              </div>
            </div>
            <Link href="/dashboard" data-testid="link-back-to-dashboard">
              <Button variant="ghost" className="flex items-center gap-2 text-white/70 hover:text-white hover:bg-white/10">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>

        <Card className="shadow-sm bg-slate-800/50 border-slate-700" data-testid="employees-table">
          <CardContent className="p-0">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">All Employees ({employees.length})</h2>
                  <p className="text-sm text-muted-foreground mt-1">Update roles and manage team members</p>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Payout class</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">App role</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Joined</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground" data-testid="no-employees">
                        No employees found. Employees will appear here once they log in.
                      </td>
                    </tr>
                  ) : (
                    employees.map((employee) => (
                      <tr key={employee.id} data-testid={`employee-row-${employee.id}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-foreground">
                                {employee.firstName} {employee.lastName}
                              </div>
                              <div className="text-sm text-muted-foreground">{employee.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Select value={employee.payoutProfile?.payoutClassification || "mover"} onValueChange={(value) => updatePayoutProfileMutation.mutate({ id: employee.id, payoutClassification: value as PayoutClassification })}>
                            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="lead_mover">Lead Mover · $30/hr</SelectItem><SelectItem value="mover">Mover · $25/hr</SelectItem><SelectItem value="helper">Helper · $20/hr</SelectItem></SelectContent>
                          </Select>
                          <p className="mt-1 text-xs capitalize text-muted-foreground">{employee.payoutProfile?.authorityTier || "worker"} · profit-bonus weight {Number(employee.payoutProfile?.defaultBonusWeight || 1).toFixed(2)}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Select
                            value={employee.role}
                            onValueChange={(value) => updateRoleMutation.mutate({ id: employee.id, role: value })}
                            data-testid={`role-select-${employee.id}`}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue>
                                <Badge variant={employee.role === 'admin' ? 'default' : 'secondary'}>
                                  {employee.role === 'admin' ? 'Admin' : employee.role === 'customer' ? 'Customer' : 'Employee'}
                                </Badge>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="employee">Employee</SelectItem>
                              <SelectItem value="admin">Administrator</SelectItem>
                              <SelectItem value="customer">Customer</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          {employee.createdAt ? new Date(employee.createdAt).toLocaleDateString() : 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" asChild data-testid={`email-employee-${employee.id}`}>
                              <a href={`mailto:${employee.email}`}>
                                <Mail className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setUserToDelete(employee)}
                              data-testid={`delete-employee-${employee.id}`}
                              className="hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {employees.length > 0 && (
              <div className="px-6 py-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground" data-testid="pagination-info">
                    Showing 1 to {employees.length} of {employees.length} results
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <strong>{userToDelete?.firstName} {userToDelete?.lastName}</strong>
              {" "}({userToDelete?.email}).
              <br /><br />
              All their data, including rewards, check-ins, and job history will be removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

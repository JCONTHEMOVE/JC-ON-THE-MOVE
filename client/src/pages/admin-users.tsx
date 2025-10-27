import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Users, 
  UserCog, 
  Search, 
  Eye,
  Wallet,
  TrendingUp,
  Award,
  Briefcase,
  Clock,
  Shield,
  ChevronRight,
  Send,
  ArrowRightLeft,
  History
} from "lucide-react";
import { Link } from "wouter";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username?: string;
  role: string;
  createdAt: string;
  referralCount: number;
}

interface UserDetails {
  user: User;
  wallet: {
    tokenBalance: string;
    totalEarnings: string;
  };
  employeeStats: {
    totalPoints: number;
    currentLevel: number;
    totalEarnedTokens: string;
    jobsCompleted: number;
    streakCount: number;
    lastActivityDate: string;
  } | null;
  recentRewards: Array<{
    id: string;
    rewardType: string;
    tokenAmount: string;
    cashValue: string;
    status: string;
    earnedDate: string;
    referenceId?: string;
  }>;
  pendingRequests: {
    cashouts: number;
    cashoutDetails: Array<{
      id: string;
      tokenAmount: string;
      usdValue: string;
      status: string;
      createdAt: string;
    }>;
  };
  jobs: {
    assignedCount: number;
    createdCount: number;
    recentAssigned: Array<{
      id: string;
      serviceType: string;
      status: string;
      createdAt: string;
    }>;
    recentCreated: Array<{
      id: string;
      serviceType: string;
      status: string;
      createdAt: string;
    }>;
  };
}

export default function AdminUsersPage() {
  const { user, hasAdminAccess, isLoading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [detailsTab, setDetailsTab] = useState("overview");
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDescription, setTransferDescription] = useState("");

  // Check if user has admin or business_owner role
  const hasAccess = hasAdminAccess || user?.role === 'business_owner';

  // Fetch all users
  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!hasAccess,
  });

  // Fetch selected user details
  const { data: userDetails, isLoading: detailsLoading } = useQuery<UserDetails>({
    queryKey: ["/api/admin/users", selectedUser, "details"],
    enabled: !!selectedUser,
  });

  // Fetch user wallet transaction history
  const { data: walletHistory, isLoading: historyLoading } = useQuery<{
    success: boolean;
    transactions: Array<{
      id: string;
      type: string;
      tokenAmount: string;
      cashValue: string;
      status: string;
      date: string;
      referenceId?: string;
      metadata?: any;
    }>;
    totalCount: number;
  }>({
    queryKey: ["/api/admin/wallet", selectedUser, "history"],
    enabled: !!selectedUser && walletModalOpen,
  });

  // Transfer tokens mutation
  const transferMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "POST",
        `/api/admin/wallet/${selectedUser}/transfer`,
        {
          tokenAmount: parseFloat(transferAmount),
          description: transferDescription || "Admin transfer"
        }
      );
      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Transfer Successful",
        description: data.message || "Tokens transferred successfully"
      });
      setTransferAmount("");
      setTransferDescription("");
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", selectedUser, "details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/wallet", selectedUser, "history"] });
    },
    onError: (error: any) => {
      toast({
        title: "Transfer Failed",
        description: error.message || "Failed to transfer tokens",
        variant: "destructive"
      });
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest(
        "DELETE",
        `/api/admin/users/${userId}`
      );
      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "User Deleted",
        description: data.message || "User successfully deleted"
      });
      setSelectedUser(null);
      setWalletModalOpen(false);
      // Refresh user list
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete user",
        variant: "destructive"
      });
    }
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardHeader>
            <div className="text-center">
              <Shield className="h-12 w-12 text-destructive mx-auto mb-3" />
              <CardTitle className="text-destructive">Access Denied</CardTitle>
              <CardDescription>Administrator privileges required</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button variant="outline" className="w-full" data-testid="button-back-to-main">
                Back to Main
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter users based on search
  const filteredUsers = users?.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.firstName?.toLowerCase().includes(searchLower) ||
      user.lastName?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.username?.toLowerCase().includes(searchLower)
    );
  }) || [];

  // Separate employees and customers
  const employees = filteredUsers.filter(u => u.role === 'employee' || u.role === 'admin' || u.role === 'business_owner');
  const customers = filteredUsers.filter(u => u.role === 'customer');

  const getRoleBadge = (role: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      admin: { variant: "destructive", label: "Admin" },
      business_owner: { variant: "destructive", label: "Owner" },
      employee: { variant: "default", label: "Employee" },
      customer: { variant: "secondary", label: "Customer" }
    };
    const config = variants[role] || variants.customer;
    return <Badge variant={config.variant} data-testid={`badge-role-${role}`}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2" data-testid="heading-admin-users">
          User Management
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          View and manage all employees and customers
        </p>
      </div>

      {/* Search Bar */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-users"
            />
          </div>
        </CardContent>
      </Card>

      {/* User Lists */}
      <Tabs defaultValue="employees" className="w-full">
        <TabsList className={`grid w-full ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} mb-6`}>
          <TabsTrigger value="employees" data-testid="tab-employees">
            <UserCog className="h-4 w-4 mr-2" />
            Employees ({employees.length})
          </TabsTrigger>
          <TabsTrigger value="customers" data-testid="tab-customers">
            <Users className="h-4 w-4 mr-2" />
            Customers ({customers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          {usersLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading employees...</p>
              </CardContent>
            </Card>
          ) : employees.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <UserCog className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No employees found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {employees.map(user => (
                <Card 
                  key={user.id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedUser(user.id)}
                  data-testid={`card-user-${user.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">
                          {user.firstName} {user.lastName}
                        </CardTitle>
                        <CardDescription className="text-sm break-all">
                          {user.email}
                        </CardDescription>
                      </div>
                      {getRoleBadge(user.role)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {user.username && (
                        <div className="flex items-center text-muted-foreground">
                          <span className="font-medium mr-2">@{user.username}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Joined</span>
                        <span className="font-medium">{formatDate(user.createdAt)}</span>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full mt-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUser(user.id);
                        }}
                        data-testid={`button-view-details-${user.id}`}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="customers">
          {usersLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading customers...</p>
              </CardContent>
            </Card>
          ) : customers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No customers found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {customers.map(user => (
                <Card 
                  key={user.id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedUser(user.id)}
                  data-testid={`card-user-${user.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">
                          {user.firstName} {user.lastName}
                        </CardTitle>
                        <CardDescription className="text-sm break-all">
                          {user.email}
                        </CardDescription>
                      </div>
                      {getRoleBadge(user.role)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {user.username && (
                        <div className="flex items-center text-muted-foreground">
                          <span className="font-medium mr-2">@{user.username}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Joined</span>
                        <span className="font-medium">{formatDate(user.createdAt)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Referrals</span>
                        <Badge variant="outline">{user.referralCount || 0}</Badge>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full mt-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUser(user.id);
                        }}
                        data-testid={`button-view-details-${user.id}`}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* User Details Modal */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className={`${isMobile ? 'max-w-[95vw] h-[90vh]' : 'max-w-3xl max-h-[85vh]'} overflow-hidden flex flex-col`}>
          {detailsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : !userDetails ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Unable to load user details</p>
              <Button variant="outline" className="mt-4" onClick={() => setSelectedUser(null)}>
                Close
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <DialogTitle className="text-xl md:text-2xl" data-testid="heading-user-details">
                      {userDetails.user.firstName} {userDetails.user.lastName}
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      {userDetails.user.email}
                    </DialogDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getRoleBadge(userDetails.user.role)}
                    {userDetails.user.role === 'customer' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete ${userDetails.user.firstName} ${userDetails.user.lastName}? This action cannot be undone.`)) {
                            deleteUserMutation.mutate(userDetails.user.id);
                          }
                        }}
                        disabled={deleteUserMutation.isPending}
                        data-testid="button-delete-user"
                      >
                        <span className="text-xs">Delete</span>
                      </Button>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <ScrollArea className="flex-1 pr-4">
                <Tabs value={detailsTab} onValueChange={setDetailsTab} className="mt-4">
                  <TabsList className={`grid w-full ${isMobile ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                    <TabsTrigger value="rewards" data-testid="tab-rewards">Rewards</TabsTrigger>
                    <TabsTrigger value="jobs" data-testid="tab-jobs">Jobs</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4 mt-4">
                    {/* Wallet Info */}
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center">
                            <Wallet className="h-4 w-4 mr-2" />
                            Wallet Balance
                          </CardTitle>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setWalletModalOpen(true)}
                            data-testid="button-manage-wallet"
                          >
                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                            Manage
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div 
                          className="flex justify-between items-center cursor-pointer hover:bg-muted p-2 rounded transition-colors"
                          onClick={() => setWalletModalOpen(true)}
                          data-testid="button-view-wallet"
                        >
                          <span className="text-muted-foreground">Token Balance</span>
                          <span className="font-bold" data-testid="text-token-balance">
                            {parseFloat(userDetails.wallet.tokenBalance).toLocaleString()} JCMOVES
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Total Earnings</span>
                          <span className="font-bold text-green-600 dark:text-green-400" data-testid="text-total-earnings">
                            ${parseFloat(userDetails.wallet.totalEarnings).toFixed(2)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Employee Stats */}
                    {userDetails.employeeStats && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center">
                            <Award className="h-4 w-4 mr-2" />
                            Employee Stats
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Level</p>
                              <p className="text-xl font-bold" data-testid="text-level">
                                {userDetails.employeeStats.currentLevel}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Points</p>
                              <p className="text-xl font-bold" data-testid="text-points">
                                {userDetails.employeeStats.totalPoints.toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Jobs Completed</p>
                              <p className="text-xl font-bold" data-testid="text-jobs-completed">
                                {userDetails.employeeStats.jobsCompleted}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Streak</p>
                              <p className="text-xl font-bold" data-testid="text-streak">
                                {userDetails.employeeStats.streakCount} days
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Pending Requests */}
                    {userDetails.pendingRequests.cashouts > 0 && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center">
                            <Clock className="h-4 w-4 mr-2" />
                            Pending Requests
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {userDetails.pendingRequests.cashoutDetails.map(cashout => (
                              <div key={cashout.id} className="flex justify-between items-center p-2 bg-muted rounded">
                                <div>
                                  <p className="font-medium">Cashout Request</p>
                                  <p className="text-sm text-muted-foreground">
                                    {cashout.tokenAmount} JCMOVES ≈ ${cashout.usdValue}
                                  </p>
                                </div>
                                <Badge>{cashout.status}</Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="rewards" className="space-y-4 mt-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center">
                          <TrendingUp className="h-4 w-4 mr-2" />
                          Recent Rewards
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {userDetails.recentRewards.length === 0 ? (
                          <p className="text-center text-muted-foreground py-4">No rewards yet</p>
                        ) : (
                          <div className="space-y-2">
                            {userDetails.recentRewards.map(reward => (
                              <div key={reward.id} className="flex justify-between items-start p-3 bg-muted rounded" data-testid={`reward-${reward.id}`}>
                                <div className="flex-1">
                                  <p className="font-medium text-sm capitalize">
                                    {reward.rewardType.replace(/_/g, ' ')}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDate(reward.earnedDate)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-sm">
                                    +{parseFloat(reward.tokenAmount).toLocaleString()} JCMOVES
                                  </p>
                                  <p className="text-xs text-green-600 dark:text-green-400">
                                    ${parseFloat(reward.cashValue).toFixed(4)}
                                  </p>
                                  <Badge variant="outline" className="mt-1">{reward.status}</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="jobs" className="space-y-4 mt-4">
                    {/* Assigned Jobs */}
                    {userDetails.jobs.assignedCount > 0 && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center">
                            <Briefcase className="h-4 w-4 mr-2" />
                            Assigned Jobs ({userDetails.jobs.assignedCount})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {userDetails.jobs.recentAssigned.map(job => (
                              <div key={job.id} className="flex justify-between items-center p-2 bg-muted rounded" data-testid={`job-assigned-${job.id}`}>
                                <div>
                                  <p className="font-medium text-sm">{job.serviceType}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDate(job.createdAt)}
                                  </p>
                                </div>
                                <Badge>{job.status}</Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Created Jobs */}
                    {userDetails.jobs.createdCount > 0 && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center">
                            <ChevronRight className="h-4 w-4 mr-2" />
                            Created Jobs ({userDetails.jobs.createdCount})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {userDetails.jobs.recentCreated.map(job => (
                              <div key={job.id} className="flex justify-between items-center p-2 bg-muted rounded" data-testid={`job-created-${job.id}`}>
                                <div>
                                  <p className="font-medium text-sm">{job.serviceType}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDate(job.createdAt)}
                                  </p>
                                </div>
                                <Badge>{job.status}</Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {userDetails.jobs.assignedCount === 0 && userDetails.jobs.createdCount === 0 && (
                      <Card>
                        <CardContent className="py-12 text-center">
                          <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">No jobs found</p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Wallet Management Modal */}
      <Dialog open={walletModalOpen} onOpenChange={setWalletModalOpen}>
        <DialogContent className={`${isMobile ? 'max-w-[95vw] h-[90vh]' : 'max-w-2xl max-h-[85vh]'} overflow-hidden flex flex-col`}>
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Wallet className="h-5 w-5 mr-2" />
              Wallet Management - {userDetails?.user.firstName} {userDetails?.user.lastName}
            </DialogTitle>
            <DialogDescription>
              Transfer tokens, view balance, and transaction history
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <Tabs defaultValue="transfer" className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="transfer" data-testid="tab-wallet-transfer">
                  <Send className="h-4 w-4 mr-2" />
                  Transfer
                </TabsTrigger>
                <TabsTrigger value="history" data-testid="tab-wallet-history">
                  <History className="h-4 w-4 mr-2" />
                  History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="transfer" className="space-y-4 mt-4">
                {/* Current Balance */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Current Balance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-4">
                      <p className="text-3xl font-bold text-primary">
                        {userDetails && parseFloat(userDetails.wallet.tokenBalance).toLocaleString()} JCMOVES
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Total Earnings: ${userDetails && parseFloat(userDetails.wallet.totalEarnings).toFixed(2)}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Transfer Form */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Transfer Tokens</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="transfer-amount">Amount (JCMOVES)</Label>
                      <Input
                        id="transfer-amount"
                        type="number"
                        placeholder="0.00"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        data-testid="input-transfer-amount"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="transfer-description">Description (Optional)</Label>
                      <Input
                        id="transfer-description"
                        placeholder="e.g., Bonus reward, Adjustment, etc."
                        value={transferDescription}
                        onChange={(e) => setTransferDescription(e.target.value)}
                        data-testid="input-transfer-description"
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => transferMutation.mutate()}
                      disabled={!transferAmount || parseFloat(transferAmount) <= 0 || transferMutation.isPending}
                      data-testid="button-execute-transfer"
                    >
                      {transferMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Transferring...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Transfer Tokens
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history" className="space-y-4 mt-4">
                {historyLoading ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-muted-foreground">Loading transaction history...</p>
                    </CardContent>
                  </Card>
                ) : walletHistory && walletHistory.transactions.length > 0 ? (
                  <div className="space-y-2">
                    {walletHistory.transactions.map(tx => (
                      <Card key={tx.id}>
                        <CardContent className="py-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium text-sm capitalize">
                                {tx.type.replace(/_/g, ' ')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(tx.date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                              {tx.referenceId && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Ref: {tx.referenceId.slice(0, 8)}...
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-sm">
                                +{parseFloat(tx.tokenAmount).toLocaleString()} JCMOVES
                              </p>
                              <p className="text-xs text-green-600 dark:text-green-400">
                                ${parseFloat(tx.cashValue).toFixed(4)}
                              </p>
                              <Badge variant="outline" className="mt-1">{tx.status}</Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No transaction history</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

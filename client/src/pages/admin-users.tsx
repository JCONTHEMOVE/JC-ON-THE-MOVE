import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
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
  ChevronRight
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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [detailsTab, setDetailsTab] = useState("overview");

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
          ) : userDetails ? (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="text-xl md:text-2xl" data-testid="heading-user-details">
                      {userDetails.user.firstName} {userDetails.user.lastName}
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      {userDetails.user.email}
                    </DialogDescription>
                  </div>
                  {getRoleBadge(userDetails.user.role)}
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
                        <CardTitle className="text-base flex items-center">
                          <Wallet className="h-4 w-4 mr-2" />
                          Wallet Balance
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between items-center">
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
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

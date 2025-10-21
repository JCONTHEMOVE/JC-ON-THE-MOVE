import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ArrowLeft, DollarSign, TrendingUp, AlertTriangle, Activity, Plus, Wallet, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";

// Treasury status interface
interface TreasuryStatus {
  stats: {
    totalFunding: number;
    totalDistributed: number;
    availableFunding: number;
    tokenReserve: number;
    currentMarketValueUsd: number;
    currentTokenPrice: number;
    priceSource: string;
    liabilityRatio: number;
    isHealthy: boolean;
  };
  funding: {
    canDistributeRewards: boolean;
    currentBalance: number;
    minimumBalance: number;
    warningThreshold: number;
  };
  health: {
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    recommendations: string[];
  };
  estimatedFundingDays: {
    estimatedDays: number;
    dailyBurnRate: number;
    recommendation: string;
  };
}

interface TreasurySummary extends TreasuryStatus {
  weeklyActivity: {
    recentDeposits: number;
    recentDistributions: number;
    activeUsersWeek: number;
  };
}

interface FundingDeposit {
  id: string;
  usdAmount: string;
  depositMethod: string;
  notes?: string;
  createdAt: string;
}

interface ReserveTransaction {
  id: string;
  transactionType: string;
  relatedEntityType: string;
  cashValue: string;
  tokenAmount: string;
  description: string;
  createdAt: string;
}

interface TreasuryAnalytics {
  rewardStats: Array<{
    rewardType: string;
    count: number;
    totalTokens: number;
    totalCash: number;
  }>;
  userStats: {
    totalUsers: number;
    activeUsers: number;
  };
  recentRewards: Array<{
    tokenAmount: string;
    cashValue: string;
    earnedDate: string;
  }>;
}

export default function TreasuryDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { isAuthenticated, hasAdminAccess, isLoading: authLoading } = useAuth();
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState('manual');
  const [depositNotes, setDepositNotes] = useState('');

  // Role-based access control
  if (authLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Checking authorization...</p>
        </div>
      </div>
    );
  }

  // Redirect unauthenticated users
  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (!hasAdminAccess) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-destructive/10 rounded-lg p-6 mb-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-3" />
            <h2 className="text-xl font-semibold text-destructive mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">
              The Treasury dashboard is only accessible to administrators and business owners. You need elevated privileges to view this page.
            </p>
          </div>
          <Link href="/dashboard">
            <Button variant="outline" className="flex items-center gap-2" data-testid="button-access-denied-back">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Fetch treasury summary (main overview)
  const { data: treasurySummary, isLoading: summaryLoading, error: summaryError, refetch: refetchSummary } = useQuery<TreasurySummary>({
    queryKey: ["/api/treasury/summary"],
    retry: (failureCount, error: any) => {
      // Don't retry on 401/403 errors
      if (error?.status === 401 || error?.status === 403) return false;
      return failureCount < 2;
    },
  });

  // Fetch funding deposits
  const { data: depositsData, isLoading: depositsLoading, error: depositsError, refetch: refetchDeposits } = useQuery<{deposits: FundingDeposit[]}>({
    queryKey: ["/api/treasury/deposits"],
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) return false;
      return failureCount < 2;
    },
  });

  // Fetch transactions
  const { data: transactionsData, isLoading: transactionsLoading, error: transactionsError, refetch: refetchTransactions } = useQuery<{transactions: ReserveTransaction[]}>({
    queryKey: ["/api/treasury/transactions"],
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) return false;
      return failureCount < 2;
    },
  });

  // Fetch analytics
  const { data: analytics, isLoading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useQuery<TreasuryAnalytics>({
    queryKey: ["/api/treasury/analytics"],
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) return false;
      return failureCount < 2;
    },
  });

  // Fetch live blockchain balance
  const { data: liveBalance, isLoading: loadingBalance, refetch: refetchBalance } = useQuery<{
    success: boolean;
    balance: number;
    walletAddress: string;
    error?: string;
  }>({
    queryKey: ["/api/solana/balance"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Handle authorization errors
  const hasAuthError = [summaryError, depositsError, transactionsError, analyticsError].some(
    (error: any) => error?.status === 401 || error?.status === 403
  );

  if (hasAuthError) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-destructive/10 rounded-lg p-6 mb-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-3" />
            <h2 className="text-xl font-semibold text-destructive mb-2">Authorization Required</h2>
            <p className="text-muted-foreground mb-4">
              Your session may have expired or you don't have the required permissions to access treasury data.
            </p>
          </div>
          <div className="space-x-2">
            <Button onClick={() => window.location.reload()} variant="outline" data-testid="button-refresh-page">
              Refresh Page
            </Button>
            <Link href="/dashboard">
              <Button variant="outline" data-testid="button-back-to-dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Deposit funds mutation
  const depositMutation = useMutation({
    mutationFn: async (depositData: { amount: number; depositMethod: string; notes?: string }) => {
      const response = await apiRequest("POST", "/api/treasury/deposit", depositData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/deposits"] });
      toast({
        title: "Deposit successful",
        description: "Funds have been added to the treasury successfully.",
      });
      setDepositAmount('');
      setDepositNotes('');
    },
    onError: (error: any) => {
      // Don't show error messages for authentication failures
      if (error.message && error.message.includes('401')) return;
      
      toast({
        title: "Deposit failed",
        description: error.message || "Failed to deposit funds. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(depositAmount);
    if (amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid deposit amount.",
        variant: "destructive",
      });
      return;
    }

    depositMutation.mutate({
      amount,
      depositMethod,
      notes: depositNotes || undefined,
    });
  };

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Healthy</Badge>;
      case 'warning':
        return <Badge variant="destructive" className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (summaryLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading treasury dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-foreground">Treasury Management</h1>
            <Link href="/dashboard" data-testid="link-back-to-dashboard">
              <Button variant="outline" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
          <p className="mt-2 text-muted-foreground">
            Manage funding, monitor rewards distribution, and track financial health
          </p>
        </div>

        {summaryError && !hasAuthError ? (
          <div className="text-center py-8">
            <div className="bg-destructive/10 rounded-lg p-6 mb-4 max-w-sm mx-auto">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-destructive mb-2">Treasury Data Unavailable</h3>
              <p className="text-muted-foreground mb-4">
                Failed to load treasury summary. Some features may be limited.
              </p>
              <Button variant="outline" onClick={() => refetchSummary()} data-testid="button-retry-summary">
                Retry Summary
              </Button>
            </div>
          </div>
        ) : treasurySummary ? (
          <>
            {/* Treasury Health Alert */}
            {treasurySummary.health && treasurySummary.health.status !== 'healthy' && (
              <div className="mb-6">
                <Card className="border-l-4 border-l-yellow-500">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      <CardTitle className="text-lg">Treasury Health Alert</CardTitle>
                      {getHealthBadge(treasurySummary.health.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-3">{treasurySummary.health.message}</p>
                    <div className="space-y-1">
                      {treasurySummary.health.recommendations.map((rec, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2 flex-shrink-0"></div>
                          <p className="text-sm">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Current Market Value</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    ${treasurySummary.stats.currentMarketValueUsd.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    JCMOVES @ ${treasurySummary.stats.currentTokenPrice.toFixed(8)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Token Reserve</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {treasurySummary.stats.tokenReserve.toFixed(0)} tokens
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Available for distribution
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Distribution Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {treasurySummary.stats.liabilityRatio.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Of total funding distributed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Funding Days</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {treasurySummary.estimatedFundingDays?.estimatedDays || 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Days remaining at current rate
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="text-muted-foreground">
              <p>No treasury data available</p>
            </div>
          </div>
        )}

        {/* Main Dashboard Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="deposits" data-testid="tab-deposits">Deposits</TabsTrigger>
            <TabsTrigger value="transactions" data-testid="tab-transactions">Transactions</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Deposit Funds Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Deposit Funds
                  </CardTitle>
                  <CardDescription>
                    Add funds to the treasury to enable reward distributions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleDeposit} className="space-y-4">
                    <div>
                      <Label htmlFor="amount">Deposit Amount ($)</Label>
                      <Input
                        id="amount"
                        type="number"
                        min="1"
                        step="0.01"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="Enter amount"
                        required
                        data-testid="input-deposit-amount"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="method">Deposit Method</Label>
                      <Select value={depositMethod} onValueChange={setDepositMethod}>
                        <SelectTrigger data-testid="select-deposit-method">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="stripe">Stripe</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        value={depositNotes}
                        onChange={(e) => setDepositNotes(e.target.value)}
                        placeholder="Add notes about this deposit"
                        data-testid="textarea-deposit-notes"
                      />
                    </div>

                    <Button 
                      type="submit" 
                      disabled={depositMutation.isPending}
                      className="w-full"
                      data-testid="button-submit-deposit"
                    >
                      {depositMutation.isPending ? "Processing..." : "Deposit Funds"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Weekly Activity Card */}
              {treasurySummary && (
                <Card>
                  <CardHeader>
                    <CardTitle>Weekly Activity</CardTitle>
                    <CardDescription>Recent treasury activity (last 7 days)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">New Deposits</span>
                      <span className="font-medium">{treasurySummary.weeklyActivity.recentDeposits}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Distributions</span>
                      <span className="font-medium">{treasurySummary.weeklyActivity.recentDistributions}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Active Users</span>
                      <span className="font-medium">{treasurySummary.weeklyActivity.activeUsersWeek}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Blockchain Balance Verification */}
            <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-blue-600" />
                  Blockchain Balance Verification
                </CardTitle>
                <CardDescription>
                  Live balance verification via Solscan.io - Compare blockchain with database records
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingBalance ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : liveBalance?.success ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border">
                        <p className="text-sm text-muted-foreground mb-1">Live Blockchain Balance</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {liveBalance.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">JCMOVES tokens</p>
                      </div>
                      <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border">
                        <p className="text-sm text-muted-foreground mb-1">Database Balance</p>
                        <p className="text-2xl font-bold">
                          {treasurySummary?.stats?.tokenReserve.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '0'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">JCMOVES tokens</p>
                      </div>
                    </div>
                    
                    {liveBalance.balance !== treasurySummary?.stats?.tokenReserve && (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-yellow-900 dark:text-yellow-100">Balance Discrepancy Detected</p>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                              Difference: {Math.abs((liveBalance.balance || 0) - (treasurySummary?.stats?.tokenReserve || 0)).toLocaleString()} JCMOVES
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {liveBalance.balance === treasurySummary?.stats?.tokenReserve && (
                      <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 bg-green-500 rounded-full" />
                          <p className="font-medium text-green-900 dark:text-green-100">✓ Balances Match</p>
                        </div>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                          Blockchain and database balances are in sync
                        </p>
                      </div>
                    )}
                    
                    <div className="pt-4 border-t space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Treasury Wallet</span>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{liveBalance.walletAddress.slice(0, 8)}...{liveBalance.walletAddress.slice(-6)}</code>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.open(`https://solscan.io/account/${liveBalance.walletAddress}`, '_blank')}
                          data-testid="button-view-solscan"
                        >
                          View on Solscan.io
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => refetchBalance()}
                          disabled={loadingBalance}
                          data-testid="button-refresh-balance"
                        >
                          {loadingBalance ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-300">
                      {liveBalance?.error || 'Failed to fetch blockchain balance'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deposits Tab */}
          <TabsContent value="deposits" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Funding Deposit History</CardTitle>
                <CardDescription>All treasury funding deposits</CardDescription>
              </CardHeader>
              <CardContent>
                {depositsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : depositsError ? (
                  <div className="text-center py-8">
                    <div className="bg-destructive/10 rounded-lg p-6 mb-4 max-w-sm mx-auto">
                      <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
                      <p className="text-muted-foreground mb-3">Failed to load deposit history</p>
                      <Button variant="outline" onClick={() => refetchDeposits()}>
                        Try Again
                      </Button>
                    </div>
                  </div>
                ) : depositsData && depositsData.deposits.length > 0 ? (
                  <div className="space-y-4">
                    {depositsData.deposits.map((deposit) => (
                      <div key={deposit.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="font-medium">${parseFloat(deposit.usdAmount).toFixed(2)}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(deposit.createdAt).toLocaleDateString()} • {deposit.depositMethod}
                          </div>
                          {deposit.notes && (
                            <div className="text-sm text-muted-foreground mt-1">{deposit.notes}</div>
                          )}
                        </div>
                        <Badge variant="secondary">Completed</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No deposits found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Reserve Transaction History</CardTitle>
                <CardDescription>All treasury reserve distributions</CardDescription>
              </CardHeader>
              <CardContent>
                {transactionsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : transactionsError ? (
                  <div className="text-center py-8">
                    <div className="bg-destructive/10 rounded-lg p-6 mb-4 max-w-sm mx-auto">
                      <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
                      <p className="text-muted-foreground mb-3">Failed to load transaction history</p>
                      <Button variant="outline" onClick={() => refetchTransactions()}>
                        Try Again
                      </Button>
                    </div>
                  </div>
                ) : transactionsData && transactionsData.transactions.length > 0 ? (
                  <div className="space-y-4">
                    {transactionsData.transactions.map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="font-medium">{transaction.description}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(transaction.createdAt).toLocaleDateString()} • {transaction.relatedEntityType}
                          </div>
                          <div className="text-sm">
                            {parseFloat(transaction.tokenAmount).toFixed(8)} tokens • ${parseFloat(transaction.cashValue).toFixed(2)}
                          </div>
                        </div>
                        <Badge variant={transaction.transactionType === 'distribution' ? 'destructive' : 'secondary'}>
                          {transaction.transactionType}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No transactions found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {analyticsLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Skeleton className="h-64" />
                <Skeleton className="h-64" />
              </div>
            ) : analyticsError ? (
              <div className="text-center py-8">
                <div className="bg-destructive/10 rounded-lg p-6 mb-4 max-w-sm mx-auto">
                  <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-destructive mb-2">Analytics Unavailable</h3>
                  <p className="text-muted-foreground mb-4">
                    Failed to load analytics data. Please try again or check your connection.
                  </p>
                  <Button variant="outline" onClick={() => refetchAnalytics()}>
                    Retry Analytics
                  </Button>
                </div>
              </div>
            ) : analytics ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Reward Distribution Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle>Reward Distribution by Type</CardTitle>
                    <CardDescription>Breakdown of all confirmed rewards</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analytics.rewardStats.length > 0 ? (
                      <div className="space-y-4">
                        {analytics.rewardStats.map((stat) => (
                          <div key={stat.rewardType} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium capitalize">{stat.rewardType.replace('_', ' ')}</span>
                              <span className="text-sm text-muted-foreground">{stat.count} rewards</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {Number(stat.totalTokens || 0).toFixed(2)} tokens • ${Number(stat.totalCash || 0).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No reward data available</p>
                    )}
                  </CardContent>
                </Card>

                {/* User Statistics */}
                <Card>
                  <CardHeader>
                    <CardTitle>User Statistics</CardTitle>
                    <CardDescription>Active user metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Total Users</span>
                        <span className="text-2xl font-bold">{analytics.userStats.totalUsers}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Active Users (30 days)</span>
                        <span className="text-2xl font-bold text-green-600">{analytics.userStats.activeUsers}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {analytics.userStats.totalUsers > 0 
                          ? `${((analytics.userStats.activeUsers / analytics.userStats.totalUsers) * 100).toFixed(1)}% activity rate`
                          : 'No activity data'
                        }
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Analytics data unavailable</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
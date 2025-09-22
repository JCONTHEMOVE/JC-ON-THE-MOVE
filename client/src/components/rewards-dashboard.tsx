import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Gift, 
  Coins, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  DollarSign, 
  Calendar,
  CreditCard,
  Zap,
  Award,
  Share2,
  Users,
  Copy,
  ExternalLink
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface WalletAccount {
  id: string;
  userId: string;
  tokenBalance: string;
  cashBalance: string;
  totalEarned: string;
  totalRedeemed: string;
  totalCashedOut: string;
}

interface CheckinStatus {
  checkedInToday: boolean;
  streakCount: number;
  nextReward?: {
    tokenAmount: number;
    cashValue: number;
  };
  nextCheckinAt?: string;
}

interface RewardHistory {
  id: string;
  rewardType: string;
  tokenAmount: string;
  cashValue: string;
  status: string;
  earnedDate: string;
  metadata?: any;
}

interface CashoutRequest {
  id: string;
  tokenAmount: string;
  cashAmount: string;
  status: string;
  createdAt: string;
  processedDate?: string;
  failureReason?: string;
}

interface TokenInfo {
  price: number;
  symbol: string;
  name: string;
}

interface ReferralStats {
  referralCount: number;
  totalEarned: number;
  referredUsers: Array<{
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    createdAt: string;
  }>;
}

export default function RewardsDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCashout, setShowCashout] = useState(false);
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [bankDetails, setBankDetails] = useState({
    accountNumber: '',
    routingNumber: '',
    accountHolderName: '',
    bankName: ''
  });
  const [referralCodeInput, setReferralCodeInput] = useState('');

  // Fetch wallet data
  const { data: wallet, isLoading: walletLoading } = useQuery<WalletAccount>({
    queryKey: ['/api/rewards/wallet'],
  });

  // Fetch check-in status
  const { data: checkinStatus, isLoading: checkinLoading } = useQuery<CheckinStatus>({
    queryKey: ['/api/rewards/checkin/status'],
  });

  // Fetch rewards history
  const { data: rewardsHistory } = useQuery<RewardHistory[]>({
    queryKey: ['/api/rewards/history'],
  });

  // Fetch cashout history
  const { data: cashoutHistory } = useQuery<CashoutRequest[]>({
    queryKey: ['/api/rewards/cashouts'],
  });

  // Fetch token info
  const { data: tokenInfo } = useQuery<TokenInfo>({
    queryKey: ['/api/rewards/token-info'],
  });

  // Fetch referral code
  const { data: referralCode } = useQuery<{ referralCode: string }>({
    queryKey: ['/api/referrals/my-code'],
  });

  // Fetch referral stats
  const { data: referralStats } = useQuery<ReferralStats>({
    queryKey: ['/api/referrals/stats'],
  });

  // Generate device fingerprint
  const generateDeviceFingerprint = () => {
    return {
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform
    };
  };

  // Daily check-in mutation
  const checkinMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/rewards/checkin', {
        deviceFingerprint: generateDeviceFingerprint()
      });
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Check-in successful!",
          description: data.message,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/rewards/checkin/status'] });
        queryClient.invalidateQueries({ queryKey: ['/api/rewards/wallet'] });
        queryClient.invalidateQueries({ queryKey: ['/api/rewards/history'] });
      } else {
        toast({
          title: "Check-in failed",
          description: data.message,
          variant: "destructive"
        });
      }
    },
    onError: (error: Error) => {
      // Don't show error messages for authentication failures
      if (error.message.includes('401')) return;
      
      toast({
        title: "Check-in failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Cashout mutation
  const cashoutMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/rewards/cashout', data);
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Cashout initiated!",
          description: `Your request for $${data.cashAmount.toFixed(2)} is being processed.`,
        });
        setShowCashout(false);
        setCashoutAmount('');
        setBankDetails({
          accountNumber: '',
          routingNumber: '',
          accountHolderName: '',
          bankName: ''
        });
        queryClient.invalidateQueries({ queryKey: ['/api/rewards/wallet'] });
        queryClient.invalidateQueries({ queryKey: ['/api/rewards/cashouts'] });
      } else {
        toast({
          title: "Cashout failed",
          description: data.error || "Something went wrong",
          variant: "destructive"
        });
      }
    },
    onError: (error: Error) => {
      // Don't show error messages for authentication failures
      if (error.message.includes('401')) return;
      
      toast({
        title: "Cashout failed",
        description: error.message || "Something went wrong",
        variant: "destructive"
      });
    }
  });

  // Apply referral code mutation
  const applyReferralMutation = useMutation({
    mutationFn: async (referralCode: string) => {
      const response = await apiRequest('POST', '/api/referrals/apply', {
        referralCode
      });
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Referral applied!",
          description: data.message,
        });
        setReferralCodeInput('');
        queryClient.invalidateQueries({ queryKey: ['/api/referrals/stats'] });
      } else {
        toast({
          title: "Failed to apply referral code",
          description: data.error,
          variant: "destructive"
        });
      }
    },
    onError: (error: Error) => {
      // Don't show error messages for authentication failures
      if (error.message.includes('401')) return;
      
      toast({
        title: "Error applying referral code",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Copy referral code to clipboard
  const copyReferralCode = async () => {
    if (referralCode?.referralCode) {
      try {
        await navigator.clipboard.writeText(referralCode.referralCode);
        toast({
          title: "Copied!",
          description: "Referral code copied to clipboard",
        });
      } catch (error) {
        toast({
          title: "Copy failed",
          description: "Could not copy referral code",
          variant: "destructive"
        });
      }
    }
  };

  const handleCashout = () => {
    if (!cashoutAmount || parseFloat(cashoutAmount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid token amount",
        variant: "destructive"
      });
      return;
    }

    if (!bankDetails.accountNumber || !bankDetails.routingNumber || !bankDetails.accountHolderName || !bankDetails.bankName) {
      toast({
        title: "Missing information",
        description: "Please fill in all bank details",
        variant: "destructive"
      });
      return;
    }

    cashoutMutation.mutate({
      tokenAmount: parseFloat(cashoutAmount),
      bankDetails
    });
  };

  const getRewardTypeIcon = (type: string) => {
    switch (type) {
      case 'daily_checkin': return <Calendar className="h-4 w-4" />;
      case 'booking': return <Award className="h-4 w-4" />;
      case 'referral': return <Gift className="h-4 w-4" />;
      case 'job_completion': return <CheckCircle className="h-4 w-4" />;
      default: return <Coins className="h-4 w-4" />;
    }
  };

  const getRewardTypeLabel = (type: string) => {
    switch (type) {
      case 'daily_checkin': return 'Daily Check-in';
      case 'booking': return 'Booking Reward';
      case 'referral': return 'Referral Bonus';
      case 'job_completion': return 'Job Completion';
      default: return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100';
      case 'completed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100';
    }
  };

  const canCheckin = checkinStatus && !checkinStatus.checkedInToday;
  const tokenBalance = parseFloat(wallet?.tokenBalance || '0');
  const cashValue = parseFloat(wallet?.cashBalance || '0');

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Rewards Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Earn {tokenInfo?.symbol || 'tokens'} through daily check-ins, bookings, and referrals
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Current Token Price</p>
          <p className="text-2xl font-bold text-foreground" data-testid="token-price">
            ${tokenInfo?.price?.toFixed(4) || '0.0000'}
          </p>
        </div>
      </div>

      {/* Wallet Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Token Balance</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="token-balance">
              {tokenBalance.toFixed(8)} {tokenInfo?.symbol || 'TOKENS'}
            </div>
            <p className="text-xs text-muted-foreground">
              ≈ ${cashValue.toFixed(2)} USD
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-earned">
              {parseFloat(wallet?.totalEarned || '0').toFixed(8)}
            </div>
            <p className="text-xs text-muted-foreground">
              All-time earnings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Check-in Streak</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="streak-count">
              {checkinStatus?.streakCount || 0} days
            </div>
            <p className="text-xs text-muted-foreground">
              Current streak
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash Out</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-cashed-out">
              ${parseFloat(wallet?.totalCashedOut || '0').toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total withdrawn
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Check-in Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Daily Check-in
          </CardTitle>
          <CardDescription>
            Check in daily to earn {tokenInfo?.symbol || 'tokens'}. Build a streak for bonus rewards!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              {checkinStatus?.checkedInToday ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Checked in today!</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-500" />
                  <span>Ready to check in</span>
                </div>
              )}
              {checkinStatus?.nextReward && (
                <p className="text-sm text-muted-foreground mt-2">
                  Next reward: {checkinStatus.nextReward.tokenAmount.toFixed(8)} {tokenInfo?.symbol || 'tokens'} 
                  (${checkinStatus.nextReward.cashValue.toFixed(4)})
                </p>
              )}
            </div>
            <Button 
              onClick={() => checkinMutation.mutate()}
              disabled={!canCheckin || checkinMutation.isPending}
              data-testid="checkin-button"
            >
              {checkinMutation.isPending ? 'Checking in...' : canCheckin ? 'Check In' : 'Already checked in'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="history" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="history" data-testid="tab-history">Rewards History</TabsTrigger>
          <TabsTrigger value="referrals" data-testid="tab-referrals">Referrals</TabsTrigger>
          <TabsTrigger value="cashout" data-testid="tab-cashout">Cash Out</TabsTrigger>
          <TabsTrigger value="transactions" data-testid="tab-transactions">Transactions</TabsTrigger>
        </TabsList>

        {/* Rewards History */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Rewards</CardTitle>
              <CardDescription>Your earning history and reward activities</CardDescription>
            </CardHeader>
            <CardContent>
              {rewardsHistory && rewardsHistory.length > 0 ? (
                <div className="space-y-4">
                  {rewardsHistory.slice(0, 10).map((reward) => (
                    <div key={reward.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getRewardTypeIcon(reward.rewardType)}
                        <div>
                          <p className="font-medium">{getRewardTypeLabel(reward.rewardType)}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(reward.earnedDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">
                          +{parseFloat(reward.tokenAmount).toFixed(8)} {tokenInfo?.symbol || 'tokens'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          ${parseFloat(reward.cashValue).toFixed(4)}
                        </p>
                        <Badge className={getStatusColor(reward.status)}>
                          {reward.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Coins className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No rewards yet. Start by checking in daily!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Referrals */}
        <TabsContent value="referrals" className="space-y-4">
          <div className="grid gap-6">
            {/* My Referral Code */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  Your Referral Code
                </CardTitle>
                <CardDescription>
                  Share your code and earn $10.00 worth of {tokenInfo?.symbol || 'tokens'} for each friend who signs up!
                </CardDescription>
              </CardHeader>
              <CardContent>
                {referralCode?.referralCode ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-lg text-center">
                      {referralCode.referralCode}
                    </div>
                    <Button onClick={copyReferralCode} variant="outline" data-testid="copy-referral-code">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">Loading your referral code...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Apply Referral Code */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5" />
                  Have a Referral Code?
                </CardTitle>
                <CardDescription>
                  Enter a friend's referral code to help them earn rewards!
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    value={referralCodeInput}
                    onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                    placeholder="Enter referral code"
                    className="font-mono"
                    data-testid="input-referral-code"
                  />
                  <Button 
                    onClick={() => applyReferralMutation.mutate(referralCodeInput)}
                    disabled={!referralCodeInput || applyReferralMutation.isPending}
                    data-testid="apply-referral-code"
                  >
                    {applyReferralMutation.isPending ? 'Applying...' : 'Apply'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Referral Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Your Referral Stats
                </CardTitle>
                <CardDescription>
                  Track your referral earnings and see who you've referred
                </CardDescription>
              </CardHeader>
              <CardContent>
                {referralStats ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{referralStats.referralCount}</p>
                        <p className="text-sm text-muted-foreground">Friends Referred</p>
                      </div>
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">${referralStats.totalEarned.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">Total Earned</p>
                      </div>
                    </div>

                    {referralStats.referredUsers.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3">Recent Referrals</h4>
                        <div className="space-y-2">
                          {referralStats.referredUsers.slice(0, 5).map((user) => (
                            <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div>
                                <p className="font-medium">
                                  {user.firstName && user.lastName 
                                    ? `${user.firstName} ${user.lastName}` 
                                    : user.email || 'Anonymous User'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Joined {new Date(user.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                              <Badge variant="secondary">
                                <Award className="h-3 w-3 mr-1" />
                                $10.00
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading referral stats...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cash Out */}
        <TabsContent value="cashout" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cash Out Tokens</CardTitle>
              <CardDescription>
                Convert your {tokenInfo?.symbol || 'tokens'} to USD and withdraw to your bank account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cashout-amount">Token Amount</Label>
                  <Input
                    id="cashout-amount"
                    type="number"
                    step="0.00000001"
                    max={tokenBalance}
                    value={cashoutAmount}
                    onChange={(e) => setCashoutAmount(e.target.value)}
                    placeholder="Enter token amount"
                    data-testid="input-cashout-amount"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Available: {tokenBalance.toFixed(8)} {tokenInfo?.symbol || 'tokens'}
                  </p>
                </div>
                <div className="flex flex-col justify-end">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Estimated USD</p>
                    <p className="text-lg font-bold" data-testid="estimated-usd">
                      ${(parseFloat(cashoutAmount) * (tokenInfo?.price || 0)).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="account-holder">Account Holder Name</Label>
                  <Input
                    id="account-holder"
                    value={bankDetails.accountHolderName}
                    onChange={(e) => setBankDetails(prev => ({ ...prev, accountHolderName: e.target.value }))}
                    placeholder="Full name on account"
                    data-testid="input-account-holder"
                  />
                </div>
                <div>
                  <Label htmlFor="bank-name">Bank Name</Label>
                  <Input
                    id="bank-name"
                    value={bankDetails.bankName}
                    onChange={(e) => setBankDetails(prev => ({ ...prev, bankName: e.target.value }))}
                    placeholder="Bank name"
                    data-testid="input-bank-name"
                  />
                </div>
                <div>
                  <Label htmlFor="account-number">Account Number</Label>
                  <Input
                    id="account-number"
                    value={bankDetails.accountNumber}
                    onChange={(e) => setBankDetails(prev => ({ ...prev, accountNumber: e.target.value }))}
                    placeholder="Account number"
                    data-testid="input-account-number"
                  />
                </div>
                <div>
                  <Label htmlFor="routing-number">Routing Number</Label>
                  <Input
                    id="routing-number"
                    value={bankDetails.routingNumber}
                    onChange={(e) => setBankDetails(prev => ({ ...prev, routingNumber: e.target.value }))}
                    placeholder="9-digit routing number"
                    data-testid="input-routing-number"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={handleCashout}
                  disabled={!cashoutAmount || parseFloat(cashoutAmount) <= 0 || cashoutMutation.isPending}
                  className="flex-1"
                  data-testid="button-submit-cashout"
                >
                  {cashoutMutation.isPending ? 'Processing...' : 'Submit Cashout Request'}
                </Button>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Minimum cashout: 1.0 {tokenInfo?.symbol || 'tokens'}</p>
                <p>• Processing time: 1-3 business days</p>
                <p>• No fees for withdrawals over $10 USD</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cashout History */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cashout History</CardTitle>
              <CardDescription>Your withdrawal history and transaction status</CardDescription>
            </CardHeader>
            <CardContent>
              {cashoutHistory && cashoutHistory.length > 0 ? (
                <div className="space-y-4">
                  {cashoutHistory.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5" />
                        <div>
                          <p className="font-medium">
                            {parseFloat(transaction.tokenAmount).toFixed(8)} {tokenInfo?.symbol || 'tokens'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(transaction.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">
                          ${parseFloat(transaction.cashAmount).toFixed(2)}
                        </p>
                        <Badge className={getStatusColor(transaction.status)}>
                          {transaction.status}
                        </Badge>
                        {transaction.failureReason && (
                          <p className="text-xs text-red-600 mt-1">{transaction.failureReason}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No cashout transactions yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
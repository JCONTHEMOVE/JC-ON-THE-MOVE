import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Gift, 
  Coins, 
  TrendingUp, 
  TrendingDown,
  Clock, 
  CheckCircle, 
  Calendar,
  Zap,
  Award,
  Share2,
  Users,
  Copy,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  History,
  ChevronRight
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface WalletAccount {
  id: string;
  userId: string;
  tokenBalance: string;
  cashBalance: string;
  totalEarned: string;
  totalRedeemed: string;
  totalCashedOut: string;
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

interface TokenInfo {
  price: number;
  symbol: string;
  name: string;
  priceChange24h?: number;
  volume24h?: number;
  marketCap?: number;
  fdv?: number;
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

interface MiningStatus {
  currentSession: any;
  accumulatedTokens: string;
  timeRemaining: number;
  totalClaimedToday: string;
  miningSpeed: string;
  streakCount: number;
  nextStreakBonus: string;
}

export default function RewardsDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [accumulatedTokens, setAccumulatedTokens] = useState("0.00000000");
  const [streakBonus, setStreakBonus] = useState("0.00000000");
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  // Fetch wallet data
  const { data: wallet, isLoading: walletLoading } = useQuery<WalletAccount>({
    queryKey: ['/api/rewards/wallet'],
  });

  // Fetch rewards history
  const { data: rewardsHistory } = useQuery<RewardHistory[]>({
    queryKey: ['/api/rewards/history'],
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

  // Fetch mining status
  const { data: miningStatus } = useQuery<MiningStatus>({
    queryKey: ["/api/mining/status"],
    refetchInterval: 5000,
  });

  // Start mining mutation
  const startMiningMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/mining/start");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mining/status"] });
      toast({
        title: "Mining Started!",
        description: "Your passive token mining has begun. Earn 1,728 JCMOVES every 24 hours!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Start Mining",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Claim tokens mutation
  const claimMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/mining/claim");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mining/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      
      const streakInfo = data.streakCount > 0 
        ? ` (${data.streakCount}-day streak bonus: +${parseFloat(data.streakBonus || 0).toFixed(2)})` 
        : '';
      
      toast({
        title: "Tokens Claimed!",
        description: `You've earned ${parseFloat(data.tokensClaimed).toFixed(2)} JCMOVES${streakInfo}! New balance: ${parseFloat(data.newBalance).toFixed(2)}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Claim Failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
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
      if (error.message.includes('401')) return;
      toast({
        title: "Error applying referral code",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Calculate accumulated tokens in real-time (2x speed: 0.02 JCMOVES/second = 1728/day)
  useEffect(() => {
    if (!miningStatus?.currentSession) return;

    const updateAccumulated = () => {
      const now = Date.now();
      const lastClaim = new Date(miningStatus.currentSession.lastClaimTime).getTime();
      const secondsElapsed = Math.floor((now - lastClaim) / 1000);
      
      const miningSpeed = parseFloat(miningStatus.miningSpeed || "1.00");
      const tokensPerSecond = 0.02; // 2x increase: 0.02 JCMOVES/second = 1728/day
      const tokensEarned = secondsElapsed * tokensPerSecond * miningSpeed;
      
      const previousAccumulated = parseFloat(miningStatus.currentSession.accumulatedTokens || "0");
      const totalAccumulated = previousAccumulated + tokensEarned;
      
      const maxTokens = 1728 * miningSpeed; // 2x increase from 864
      const cappedTokens = Math.min(totalAccumulated, maxTokens);
      
      setAccumulatedTokens(cappedTokens.toFixed(8));

      // Calculate streak bonus in real-time
      const streakCount = miningStatus.streakCount || 0;
      const bonusPercentage = (streakCount - 1) * 0.01; // Day 1: 0%, Day 2: 1%, Day 3: 2%, etc.
      const calculatedBonus = cappedTokens * bonusPercentage;
      setStreakBonus(calculatedBonus.toFixed(8));
    };

    updateAccumulated();
    const interval = setInterval(updateAccumulated, 100);

    return () => clearInterval(interval);
  }, [miningStatus]);

  // Countdown timer
  useEffect(() => {
    if (!miningStatus?.currentSession) return;

    const updateTimer = () => {
      const now = Date.now();
      const nextClaim = new Date(miningStatus.currentSession.nextClaimAt).getTime();
      const remaining = Math.max(0, nextClaim - now);
      
      setTimeRemaining(remaining);

      if (remaining === 0 && parseFloat(accumulatedTokens) > 0) {
        claimMutation.mutate();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [miningStatus, accumulatedTokens]);

  // Format time remaining
  const formatTimeRemaining = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

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

  const tokenBalance = parseFloat(wallet?.tokenBalance || '0');
  const cashValue = parseFloat(wallet?.cashBalance || '0');
  const hasActiveSession = !!miningStatus?.currentSession;

  // Generate simple mock chart data for holdings visualization
  const generateChartData = () => {
    const currentValue = tokenBalance * (tokenInfo?.price || 0);
    // Create a simple upward trending chart with some variation
    return Array.from({ length: 7 }, (_, i) => ({
      day: i,
      value: currentValue * (0.85 + (i * 0.025) + Math.random() * 0.05)
    }));
  };

  const chartData = generateChartData();
  const priceChange24h = tokenInfo?.priceChange24h || 0;
  const isPositiveChange = priceChange24h >= 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 dark:from-gray-900 dark:via-blue-950 dark:to-gray-900">
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Rewards Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Earn {tokenInfo?.symbol || 'JCMOVES'} through mining and referrals
          </p>
        </div>
        {/* Enhanced Token Price Widget */}
        <Card className="w-full md:w-auto min-w-[280px]">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Token Price</p>
                <p className="text-2xl font-bold text-foreground" data-testid="token-price">
                  ${tokenInfo?.price?.toFixed(6) || '0.000000'}
                </p>
                <div className={`flex items-center gap-1 mt-1 ${isPositiveChange ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {isPositiveChange ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  <span className="text-xs font-medium">
                    {isPositiveChange ? '+' : ''}{priceChange24h.toFixed(2)}% (24h)
                  </span>
                </div>
                {tokenInfo?.volume24h && tokenInfo.volume24h > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Vol: ${(tokenInfo.volume24h / 1000).toFixed(1)}k
                  </p>
                )}
              </div>
              {/* Mini Holdings Chart */}
              <div className="w-24 h-16">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke={isPositiveChange ? "#22c55e" : "#ef4444"}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Your Holdings: <span className="font-semibold text-foreground">${(tokenBalance * (tokenInfo?.price || 0)).toFixed(2)}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Wallet Overview - Condensed to 2 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
          onClick={() => setWalletModalOpen(true)}
          data-testid="card-wallet-balance"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance & Holdings</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="token-balance">
              {tokenBalance.toFixed(2)} {tokenInfo?.symbol || 'JCMOVES'}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              Portfolio Value: <span className="font-semibold text-foreground ml-1">${(tokenBalance * (tokenInfo?.price || 0)).toFixed(2)}</span>
              <ChevronRight className="h-3 w-3 ml-1" />
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Streak & Earnings</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold" data-testid="streak-count">
                {miningStatus?.streakCount || 0} days
              </span>
              {miningStatus?.streakCount && miningStatus.streakCount > 1 && (
                <Badge variant="secondary" className="text-xs">
                  +{((miningStatus.streakCount - 1) * 1)}% bonus
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total Earned: <span className="font-semibold text-foreground" data-testid="total-earned">{parseFloat(wallet?.totalEarned || '0').toFixed(2)}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="mining" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="mining" data-testid="tab-mining">
            <Zap className="h-4 w-4 mr-2" />
            Mining
          </TabsTrigger>
          <TabsTrigger value="referrals" data-testid="tab-referrals">
            <Users className="h-4 w-4 mr-2" />
            Referrals
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <Clock className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Mining Tab */}
        <TabsContent value="mining" className="space-y-4">
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Balance Card - Gradient Style */}
            <Card className="p-6 bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 text-white border-0 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Mining Balance</p>
                  <p className="text-3xl font-bold mt-1">
                    {parseFloat(accumulatedTokens).toFixed(2)}
                  </p>
                  <p className="text-xs opacity-75 mt-1">JCMOVES</p>
                </div>
                <Coins className="h-12 w-12 opacity-80" />
              </div>
            </Card>

            {!hasActiveSession ? (
              <Card className="p-8 text-center">
                <Zap className="h-16 w-16 mx-auto text-orange-500 mb-4" />
                <h2 className="text-xl font-bold mb-2">Start Mining JCMOVES</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Begin earning passive tokens automatically. You'll receive 1,728 JCMOVES every 24 hours! (2x Boost Active)
                </p>
                <Button
                  onClick={() => startMiningMutation.mutate()}
                  disabled={startMiningMutation.isPending}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                  data-testid="button-start-mining"
                >
                  {startMiningMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Start Mining
                    </>
                  )}
                </Button>
              </Card>
            ) : (
              <>
                <Card className="p-6 bg-gradient-to-br from-orange-400 to-red-500 text-white border-0 shadow-lg">
                  <div className="space-y-4">
                    <div className="text-center">
                      <p className="text-sm opacity-90">Next Claim In</p>
                      <p className="text-4xl font-bold font-mono mt-1" data-testid="text-countdown-timer">
                        {formatTimeRemaining(timeRemaining)}
                      </p>
                    </div>

                    <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs opacity-90">Base Tokens</p>
                          <p className="text-2xl font-bold" data-testid="text-accumulated-tokens">
                            {parseFloat(accumulatedTokens).toFixed(4)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs opacity-90">Speed</p>
                          <p className="text-2xl font-bold" data-testid="text-mining-speed">
                            {parseFloat(miningStatus.miningSpeed || "1.00").toFixed(0)}X
                          </p>
                        </div>
                      </div>
                      
                      {miningStatus?.streakCount > 0 && (
                        <div className="border-t border-white/30 pt-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Award className="h-4 w-4" />
                              <span className="text-xs opacity-90">
                                {miningStatus.streakCount} Day Streak Bonus
                              </span>
                            </div>
                            <span className="text-lg font-bold" data-testid="text-streak-bonus">
                              +{parseFloat(streakBonus || "0").toFixed(4)}
                            </span>
                          </div>
                          <div className="mt-2 text-center">
                            <p className="text-sm font-semibold">
                              Total: {(parseFloat(accumulatedTokens) + parseFloat(streakBonus || "0")).toFixed(4)} JCMOVES
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <Button
                      disabled
                      className="w-full bg-white/30 hover:bg-white/40 text-white border-white/50"
                      data-testid="button-speed-up"
                    >
                      <Zap className="mr-2 h-4 w-4" />
                      Speed Up (Coming Soon)
                    </Button>

                    <Button
                      onClick={() => claimMutation.mutate()}
                      disabled={claimMutation.isPending || parseFloat(accumulatedTokens) === 0}
                      className="w-full bg-white text-orange-600 hover:bg-gray-100"
                      data-testid="button-claim-tokens"
                    >
                      {claimMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Claiming...
                        </>
                      ) : (
                        <>
                          <Coins className="mr-2 h-4 w-4" />
                          Claim Tokens Now
                        </>
                      )}
                    </Button>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-orange-500" data-testid="text-daily-rate">
                        1,728
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Tokens/Day (2X)</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-orange-500" data-testid="text-claimed-today">
                        {parseFloat(miningStatus.totalClaimedToday || "0").toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Claimed Today</p>
                    </div>
                  </div>
                </Card>
              </>
            )}

            {/* TrustDice Faucet Widget */}
            <Card className="p-6 bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800 text-white border-0 shadow-xl">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="text-6xl">🏴‍☠️</div>
                </div>
                <h3 className="text-2xl font-bold">TrustDice Crypto Faucet</h3>
                <p className="text-sm opacity-90">
                  Claim free crypto every 6 hours! Earn Bitcoin, Ethereum, and more from the TrustDice faucet.
                </p>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 space-y-2">
                  <p className="text-xs opacity-75">Referral Code</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-black/30 px-3 py-2 rounded font-mono text-sm">
                      u_jconthemove
                    </code>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText('u_jconthemove');
                        toast({
                          title: "Copied!",
                          description: "Referral code copied to clipboard",
                        });
                      }}
                      data-testid="button-copy-trustdice-code"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button
                  asChild
                  className="w-full bg-white text-purple-700 hover:bg-gray-100 font-semibold"
                  data-testid="button-trustdice-faucet"
                >
                  <a
                    href="https://trustdice.win/?ref=u_jconthemove"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                    Open TrustDice Faucet
                  </a>
                </Button>
                <p className="text-xs opacity-75">
                  Use our referral code when signing up to support JCMOVES!
                </p>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Referrals Tab */}
        <TabsContent value="referrals" className="space-y-4">
          <div className="grid gap-6">
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

        {/* Rewards History Tab */}
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
                  <p className="text-muted-foreground">No rewards yet. Start mining to earn tokens!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Wallet Details Modal */}
      <Dialog open={walletModalOpen} onOpenChange={setWalletModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              My Wallet
            </DialogTitle>
            <DialogDescription>
              View your token balance and transaction history
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Wallet Balance Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Balance Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Token Balance</span>
                  <span className="text-2xl font-bold">
                    {tokenBalance.toFixed(2)} {tokenInfo?.symbol || 'JCMOVES'}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">USD Value</span>
                  <span className="text-xl font-bold text-green-600 dark:text-green-400">
                    ${cashValue.toFixed(2)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Earned</span>
                  <span className="font-medium">
                    {parseFloat(wallet?.totalEarned || '0').toFixed(2)} {tokenInfo?.symbol || 'JCMOVES'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] pr-4">
                  {rewardsHistory && rewardsHistory.length > 0 ? (
                    <div className="space-y-3">
                      {rewardsHistory.slice(0, 15).map((reward) => (
                        <div key={reward.id} className="flex items-start justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-start gap-3">
                            {getRewardTypeIcon(reward.rewardType)}
                            <div>
                              <p className="font-medium text-sm">{getRewardTypeLabel(reward.rewardType)}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(reward.earnedDate).toLocaleDateString()} {new Date(reward.earnedDate).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm text-green-600 dark:text-green-400">
                              +{parseFloat(reward.tokenAmount).toFixed(4)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              ${parseFloat(reward.cashValue).toFixed(4)}
                            </p>
                            <Badge variant="outline" className={`mt-1 text-xs ${getStatusColor(reward.status)}`}>
                              {reward.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No transactions yet</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  );
}

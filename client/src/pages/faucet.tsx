import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueries } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Bitcoin, 
  Coins, 
  Clock, 
  Wallet, 
  TrendingUp, 
  AlertCircle,
  CheckCircle,
  Timer,
  Gift,
  UserPlus,
  Zap,
  DollarSign,
  Sparkles
} from "lucide-react";

interface FaucetConfig {
  currency: string;
  rewardAmount: string;
  claimInterval: number;
  isEnabled: boolean;
  minPayout: string;
}

interface ClaimStatus {
  canClaim: boolean;
  nextClaimTime?: string;
  secondsRemaining?: number;
  totalEarned: string;
  totalClaims: number;
  lastClaimTime?: string;
}

interface FaucetClaim {
  id: string;
  currency: string;
  rewardAmount: string;
  cashValue: string;
  status: string;
  createdAt: string;
  faucetpayPayoutId?: string;
}

const CURRENCY_ICONS = {
  BTC: <Bitcoin className="w-6 h-6 text-orange-500" />,
  ETH: <Coins className="w-6 h-6 text-blue-500" />,
  LTC: <Coins className="w-6 h-6 text-gray-500" />,
  DOGE: <Coins className="w-6 h-6 text-yellow-500" />
};

const CURRENCY_COLORS = {
  BTC: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  ETH: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  LTC: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  DOGE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
};

// Helper function to format claim intervals into human-readable text
function formatClaimInterval(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  } else {
    const days = Math.floor(seconds / 86400);
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
}

function FaucetTimer({ 
  targetTime, 
  claimInterval, 
  onComplete 
}: { 
  targetTime: string, 
  claimInterval: number, 
  onComplete: () => void 
}) {
  const [timeLeft, setTimeLeft] = useState("");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const target = new Date(targetTime).getTime();
      const difference = target - now;

      if (difference <= 0) {
        setTimeLeft("Ready to claim!");
        setProgress(100);
        onComplete();
        clearInterval(interval);
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      
      // Calculate progress using actual claim interval
      const totalInterval = claimInterval * 1000; // claimInterval is in seconds
      const elapsed = totalInterval - difference;
      const progressPercent = Math.max(0, Math.min(100, (elapsed / totalInterval) * 100));
      setProgress(progressPercent);
    }, 1000);

    return () => clearInterval(interval);
  }, [targetTime, claimInterval, onComplete]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Next claim</span>
        <span className="font-mono font-medium">{timeLeft}</span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}

function RoboxTimer() {
  const [timeLeft, setTimeLeft] = useState("02:59:43");

  useEffect(() => {
    const startTime = Date.now();
    const initialSeconds = 2 * 3600 + 59 * 60 + 43;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, initialSeconds - elapsed);

      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      const seconds = remaining % 60;

      setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);

      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <span className="font-mono font-bold text-orange-500" data-testid="text-robox-timer">
      {timeLeft}
    </span>
  );
}

function RoboxCard() {
  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 border-orange-500/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <CardTitle className="text-lg text-white">Robox</CardTitle>
              <CardDescription className="text-slate-400">
                Earn ROX tokens passively
              </CardDescription>
            </div>
          </div>
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
            ROX
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="bg-slate-800/50 rounded-lg p-4 border border-orange-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Balance</span>
            <Wallet className="w-4 h-4 text-orange-500" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-white" data-testid="text-robox-balance">
              0.05433525 ROX
            </div>
            <div className="text-sm text-slate-400 flex items-center" data-testid="text-robox-balance-usd">
              <DollarSign className="w-3 h-3 mr-1" />
              0.05 USD
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4 border border-orange-500/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-400">Creating</span>
            <Zap className="w-4 h-4 text-orange-500" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300" data-testid="text-robox-generating">
                0.00000397 ROX
              </span>
              <Badge variant="outline" className="text-orange-400 border-orange-500/30" data-testid="badge-robox-speed">
                Speed: 1X
              </Badge>
            </div>
            <Separator className="bg-slate-700" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Time remaining</span>
              <RoboxTimer />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500/10 to-orange-600/10 rounded-lg p-4 border border-orange-500/30">
          <div className="flex items-start space-x-3 mb-3">
            <UserPlus className="w-5 h-5 text-orange-500 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-white mb-1">
                Invite people to get more ROX!
              </div>
              <div className="text-xs text-slate-400">
                Share your referral link and earn rewards
              </div>
            </div>
          </div>
          <a
            href="https://robox.digital/i/2468892"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full"
            data-testid="link-robox-invite"
          >
            <Button
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              size="lg"
              data-testid="button-robox-invite"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Invite
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

function ZBDCard() {
  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 border-blue-500/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Zap className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-lg text-white">ZBD App</CardTitle>
              <CardDescription className="text-slate-400">
                Earn Bitcoin (satoshis)
              </CardDescription>
            </div>
          </div>
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            BTC
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs defaultValue="poll" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-800/50">
            <TabsTrigger 
              value="poll" 
              className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400"
              data-testid="tab-zbd-poll"
            >
              Daily Poll
            </TabsTrigger>
            <TabsTrigger 
              value="videos" 
              className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400"
              data-testid="tab-zbd-videos"
            >
              Quick Earn
            </TabsTrigger>
          </TabsList>

          <TabsContent value="poll" className="space-y-4 mt-4">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-blue-500/20">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-400">Daily Poll</span>
                <Badge variant="outline" className="text-green-400 border-green-500/30">
                  Next in 11 hours
                </Badge>
              </div>
              <div className="text-sm text-slate-300 mb-4">
                What's the best way to spend a rainy day?
              </div>
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-zbd-poll"
              >
                Answer & earn sats
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="videos" className="space-y-4 mt-4">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-blue-500/20">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-400">Quick Earn</span>
                <Sparkles className="w-4 h-4 text-blue-500" />
              </div>
              <div className="space-y-2 mb-4">
                <div className="text-sm text-slate-300">
                  Watch a video, get 5 sats!
                </div>
                <div className="text-xs text-slate-400">
                  Earn Bitcoin by watching short videos
                </div>
              </div>
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-zbd-watch"
              >
                Watch
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg p-4 border border-blue-500/30">
          <div className="flex items-start space-x-3 mb-3">
            <Gift className="w-5 h-5 text-green-500 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-white mb-1">
                $2 for you, $2 for a friend
              </div>
              <div className="text-xs text-slate-400">
                Invite friends and earn $2 in sats for each verified signup
              </div>
            </div>
          </div>
          <a
            href="https://zbd.link/hcHi/invite?af_sub1=9C31P8&deep_link_value=fwb_two_for_two"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full"
            data-testid="link-zbd-invite"
          >
            <Button
              className="w-full bg-green-500 hover:bg-green-600 text-white"
              size="lg"
              data-testid="button-zbd-invite"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Share
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

function CurrencyFaucetCard({ 
  config, 
  claimStatus, 
  walletAddress, 
  setWalletAddress, 
  onClaim 
}: {
  config: FaucetConfig;
  claimStatus: ClaimStatus | undefined;
  walletAddress: string;
  setWalletAddress: (address: string) => void;
  onClaim: (currency: string, address: string) => void;
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshStatus = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['/api/faucet/claim-status', config.currency] });
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleClaim = () => {
    if (!walletAddress.trim()) {
      return;
    }
    onClaim(config.currency, walletAddress.trim());
  };

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {CURRENCY_ICONS[config.currency as keyof typeof CURRENCY_ICONS]}
            <div>
              <CardTitle className="text-lg">{config.currency}</CardTitle>
              <CardDescription>
                Earn {config.rewardAmount} {config.currency} every {formatClaimInterval(config.claimInterval)}
              </CardDescription>
            </div>
          </div>
          <Badge className={CURRENCY_COLORS[config.currency as keyof typeof CURRENCY_COLORS]}>
            {config.currency}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Ember Referral Link for BTC */}
        {config.currency === 'BTC' && (
          <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
            <Bitcoin className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              <div className="space-y-2">
                <div className="font-medium">Get Free Bitcoin with Ember!</div>
                <div className="text-sm">Referral Code: <strong>MNG-POKER-LPG</strong></div>
                <a 
                  href="https://emberfund.onelink.me/ljTI/l4g18zii?mining_referrer_id=MNG-POKER-LPG"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm font-medium text-orange-700 dark:text-orange-300 hover:underline"
                  data-testid="link-ember-referral"
                >
                  Click here to claim BTC with Ember →
                </a>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Wallet Address Input */}
        <div className="space-y-2">
          <Label htmlFor={`wallet-${config.currency}`}>
            FaucetPay {config.currency} Address
          </Label>
          <Input
            id={`wallet-${config.currency}`}
            placeholder={`Enter your FaucetPay ${config.currency} address`}
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            data-testid={`input-wallet-${config.currency.toLowerCase()}`}
          />
        </div>

        {/* Claim Status and Timer */}
        {claimStatus && (
          <div className="space-y-3">
            {claimStatus.canClaim ? (
              <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  Ready to claim {config.rewardAmount} {config.currency}!
                </AlertDescription>
              </Alert>
            ) : claimStatus.nextClaimTime ? (
              <div className="space-y-2">
                <Alert>
                  <Timer className="h-4 w-4" />
                  <AlertDescription>
                    Next claim available in:
                  </AlertDescription>
                </Alert>
                <FaucetTimer 
                  targetTime={claimStatus.nextClaimTime} 
                  claimInterval={config.claimInterval}
                  onComplete={refreshStatus}
                />
              </div>
            ) : null}

            {/* User Statistics */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {parseFloat(claimStatus.totalEarned).toFixed(8)}
                </div>
                <div className="text-xs text-muted-foreground">Total Earned</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {claimStatus.totalClaims}
                </div>
                <div className="text-xs text-muted-foreground">Total Claims</div>
              </div>
            </div>
          </div>
        )}

        {/* Claim Button */}
        <Button
          onClick={handleClaim}
          disabled={!claimStatus?.canClaim || !walletAddress.trim() || isRefreshing}
          className="w-full"
          size="lg"
          data-testid={`button-claim-${config.currency.toLowerCase()}`}
        >
          {isRefreshing ? (
            "Refreshing..."
          ) : claimStatus?.canClaim ? (
            <>
              <Gift className="mr-2 h-4 w-4" />
              Claim {config.rewardAmount} {config.currency}
            </>
          ) : (
            <>
              <Clock className="mr-2 h-4 w-4" />
              Waiting for next claim
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function ClaimHistory() {
  const { data: claimsData, isLoading } = useQuery({
    queryKey: ['/api/faucet/claims'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Claim History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const claims: FaucetClaim[] = (claimsData as any)?.claims || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <TrendingUp className="mr-2 h-5 w-5" />
          Claim History
        </CardTitle>
        <CardDescription>
          Your recent cryptocurrency claims
        </CardDescription>
      </CardHeader>
      <CardContent>
        {claims.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wallet className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No claims yet. Start earning cryptocurrency above!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {claims.slice(0, 10).map((claim) => (
              <div 
                key={claim.id} 
                className="flex items-center justify-between p-3 border rounded-lg"
                data-testid={`claim-${claim.id}`}
              >
                <div className="flex items-center space-x-3">
                  {CURRENCY_ICONS[claim.currency as keyof typeof CURRENCY_ICONS]}
                  <div>
                    <div className="font-medium">
                      +{claim.rewardAmount} {claim.currency}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ≈ ${claim.cashValue} USD
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge 
                    variant={claim.status === 'paid' ? 'default' : 'secondary'}
                    className={claim.status === 'paid' ? 'bg-green-100 text-green-800' : ''}
                  >
                    {claim.status}
                  </Badge>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(claim.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function FaucetPage() {
  const { toast } = useToast();
  const [walletAddresses, setWalletAddresses] = useState<Record<string, string>>({});

  // Get faucet configuration
  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ['/api/faucet/config'],
  });

  // Get claim status for each currency with stable queries to prevent data mismatch
  const currencies = (configData as any)?.currencies || [];
  
  // Create stable query configuration for each supported currency
  const supportedCurrencies = ['BTC', 'ETH', 'LTC', 'DOGE'];
  const claimStatusQueries = useQueries({
    queries: supportedCurrencies.map((currency) => ({
      queryKey: ['/api/faucet/claim-status', currency],
      enabled: currencies.some((config: FaucetConfig) => config.currency === currency),
      refetchInterval: 5000,
    }))
  });

  // Create a map for easier lookup
  const claimStatusMap = supportedCurrencies.reduce((acc, currency, index) => {
    acc[currency] = claimStatusQueries[index];
    return acc;
  }, {} as Record<string, any>);

  // Claim mutation
  const claimMutation = useMutation({
    mutationFn: async ({ currency, address }: { currency: string; address: string }) => {
      return apiRequest('/api/faucet/claim', 'POST', {
        currency,
        faucetpayAddress: address,
        deviceFingerprint: navigator.userAgent
      });
    },
    onSuccess: (data: any, variables) => {
      // Safely extract response data with proper fallbacks
      const reward = data?.reward || {};
      const amount = reward.amount || data?.amount || 'some';
      const payoutId = reward.payoutId || data?.payoutId || data?.payout_id || 'unknown';
      
      toast({
        title: "Claim Successful! 🎉",
        description: `You earned ${amount} ${variables.currency}! Payment ID: ${payoutId}`,
      });
      
      // Refresh all claim statuses
      currencies.forEach((config: FaucetConfig) => {
        queryClient.invalidateQueries({ queryKey: ['/api/faucet/claim-status', config.currency] });
      });
      queryClient.invalidateQueries({ queryKey: ['/api/faucet/claims'] });
    },
    onError: (error: any) => {
      toast({
        title: "Claim Failed",
        description: error.error || "Failed to process your claim. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleClaim = (currency: string, address: string) => {
    claimMutation.mutate({ currency, address });
  };

  const setWalletAddress = (currency: string, address: string) => {
    setWalletAddresses(prev => ({ ...prev, [currency]: address }));
  };

  if (configLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <div className="h-8 bg-muted animate-pulse rounded w-48 mx-auto mb-4" />
            <div className="h-4 bg-muted animate-pulse rounded w-96 mx-auto" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-96 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!(configData as any)?.isConfigured) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <Alert className="border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The faucet system is currently being configured. Please check back later!
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Cryptocurrency Faucet</h1>
          <p className="text-xl text-muted-foreground mb-6">
            Earn free cryptocurrency regularly! Get Bitcoin (ZBD app), Ethereum, Litecoin, and ROX tokens.
          </p>
          <div className="flex justify-center space-x-4 text-sm text-muted-foreground">
            <span>✨ No deposits required</span>
            <span>🔒 Secure payments via FaucetPay</span>
            <span>⚡ Instant payouts</span>
          </div>
        </div>

        <Tabs defaultValue="faucets" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="faucets" data-testid="tab-faucets">
              Faucets
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="faucets" className="space-y-6">
            {/* Faucet Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {currencies
                .filter((config: FaucetConfig) => config.currency !== 'DOGE' && config.currency !== 'BTC')
                .map((config: FaucetConfig) => {
                  const claimQuery = claimStatusMap[config.currency];
                  return (
                    <CurrencyFaucetCard
                      key={config.currency}
                      config={config}
                      claimStatus={claimQuery?.data}
                      walletAddress={walletAddresses[config.currency] || ''}
                      setWalletAddress={(address) => setWalletAddress(config.currency, address)}
                      onClaim={handleClaim}
                    />
                  );
                })}
              <ZBDCard />
              <RoboxCard />
            </div>

            {/* Information Cards */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <AlertCircle className="mr-2 h-5 w-5" />
                    How It Works
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">1</div>
                    <p className="text-sm">Create a free FaucetPay account at faucetpay.io</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">2</div>
                    <p className="text-sm">Enter your FaucetPay wallet address above</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">3</div>
                    <p className="text-sm">Claim free cryptocurrency based on each currency's schedule</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">4</div>
                    <p className="text-sm">Withdraw to your personal wallet anytime</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Wallet className="mr-2 h-5 w-5" />
                    Payment Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <strong>Instant Payments:</strong> All rewards are sent directly to your FaucetPay account within seconds.
                  </div>
                  <div className="text-sm">
                    <strong>Minimum Payout:</strong> No minimum! Start earning immediately.
                  </div>
                  <div className="text-sm">
                    <strong>Claim Frequency:</strong> Varies by cryptocurrency (check each faucet card for timing).
                  </div>
                  <div className="text-sm">
                    <strong>Support:</strong> If you have issues, contact our support team.
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <ClaimHistory />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
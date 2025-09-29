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
  Gift
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
            Earn free cryptocurrency regularly! Get Bitcoin, Ethereum, Litecoin, and Dogecoin.
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
              {currencies.map((config: FaucetConfig) => {
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
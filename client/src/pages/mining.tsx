import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Loader2, Zap, Users, Coins } from "lucide-react";
import { Link } from "wouter";

export default function MiningPage() {
  const { toast } = useToast();
  const [accumulatedTokens, setAccumulatedTokens] = useState("0.00000000");
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Get mining status
  const { data: miningStatus, isLoading } = useQuery({
    queryKey: ["/api/mining/status"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Start mining mutation
  const startMiningMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/mining/start", {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mining/status"] });
      toast({
        title: "Mining Started!",
        description: "Your passive token mining has begun. Earn 864 JCMOVES every 24 hours!",
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
      return await apiRequest("/api/mining/claim", {
        method: "POST",
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mining/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      toast({
        title: "Tokens Claimed!",
        description: `You've earned ${parseFloat(data.tokensClaimed).toFixed(2)} JCMOVES! New balance: ${parseFloat(data.newBalance).toFixed(2)}`,
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

  // Calculate accumulated tokens in real-time
  useEffect(() => {
    if (!miningStatus?.currentSession) return;

    const updateAccumulated = () => {
      const now = Date.now();
      const lastClaim = new Date(miningStatus.currentSession.lastClaimTime).getTime();
      const secondsElapsed = Math.floor((now - lastClaim) / 1000);
      
      const miningSpeed = parseFloat(miningStatus.miningSpeed || "1.00");
      const tokensPerSecond = 0.01; // 0.01 JCMOVES per second
      const tokensEarned = secondsElapsed * tokensPerSecond * miningSpeed;
      
      const previousAccumulated = parseFloat(miningStatus.currentSession.accumulatedTokens || "0");
      const totalAccumulated = previousAccumulated + tokensEarned;
      
      // Cap at 24-hour maximum (864 tokens)
      const maxTokens = 864 * miningSpeed;
      const cappedTokens = Math.min(totalAccumulated, maxTokens);
      
      setAccumulatedTokens(cappedTokens.toFixed(8));
    };

    updateAccumulated();
    const interval = setInterval(updateAccumulated, 100); // Update every 100ms for smooth animation

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

      // Auto-claim when timer reaches zero
      if (remaining === 0 && parseFloat(accumulatedTokens) > 0) {
        claimMutation.mutate();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000); // Update every second

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasActiveSession = !!miningStatus?.currentSession;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 p-4 pb-24 md:pb-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="text-center pt-6 pb-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Token Mining</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Earn 864 JCMOVES every 24 hours
          </p>
        </div>

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
          /* Start Mining Button */
          <Card className="p-8 text-center">
            <Zap className="h-16 w-16 mx-auto text-orange-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Start Mining JCMOVES</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Begin earning passive tokens automatically. You'll receive 864 JCMOVES every 24 hours!
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
            {/* Mining Section - Orange/Coral Theme */}
            <Card className="p-6 bg-gradient-to-br from-orange-400 to-red-500 text-white border-0 shadow-lg">
              <div className="space-y-4">
                {/* Timer Display */}
                <div className="text-center">
                  <p className="text-sm opacity-90">Next Claim In</p>
                  <p className="text-4xl font-bold font-mono mt-1" data-testid="text-countdown-timer">
                    {formatTimeRemaining(timeRemaining)}
                  </p>
                </div>

                {/* Accumulating Amount */}
                <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs opacity-90">Accumulating</p>
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
                </div>

                {/* Speed Up Button (Placeholder) */}
                <Button
                  disabled
                  className="w-full bg-white/30 hover:bg-white/40 text-white border-white/50"
                  data-testid="button-speed-up"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Speed Up (Coming Soon)
                </Button>

                {/* Manual Claim Button */}
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

            {/* Stats Card */}
            <Card className="p-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-orange-500" data-testid="text-daily-rate">
                    864
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Tokens/Day</p>
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

        {/* Referral Section */}
        <Card className="p-6 bg-gradient-to-br from-blue-500 to-purple-600 text-white border-0 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
              <Users className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">Invite Friends</h3>
              <p className="text-sm opacity-90 mt-1">
                Share your referral code and earn bonus tokens when friends join!
              </p>
              <Link href="/dashboard">
                <Button
                  className="mt-4 w-full bg-white text-blue-600 hover:bg-gray-100"
                  data-testid="button-invite-friends"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Go to Referrals
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

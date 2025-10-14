import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wallet, ArrowRightLeft, DollarSign, TrendingUp, TrendingDown, Activity } from "lucide-react";

interface MoonshotTransfer {
  tokenAmount: number;
  transactionHash: string;
  moonshotAccountId?: string;
  notes?: string;
}

interface LivePrice {
  price: number;
  priceFormatted: string;
  change24h: number | null;
  changePercent24h: string | null;
  volume24h: number | null;
  volumeFormatted: string | null;
  symbol: string;
  tokenName: string;
  lastUpdated: string;
  status: 'live' | 'fallback';
}

export default function AdminMoonshotPage() {
  const { toast } = useToast();
  const [transferData, setTransferData] = useState<MoonshotTransfer>({
    tokenAmount: 0,
    transactionHash: "",
    moonshotAccountId: "",
    notes: ""
  });

  // Get live token price with real-time updates (every 5 seconds)
  const { data: livePrice, isLoading: loadingPrice } = useQuery<LivePrice>({
    queryKey: ["/api/crypto/live-price"],
    refetchInterval: 5000, // Refresh every 5 seconds for live updates
  });

  // Get treasury status
  const { data: treasuryStatus, isLoading: loadingTreasury } = useQuery({
    queryKey: ["/api/treasury/status"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Get funding deposits history
  const { data: depositsData, isLoading: loadingDeposits } = useQuery({
    queryKey: ["/api/treasury/deposits"],
    refetchInterval: 30000,
  });

  // Moonshot deposit mutation - auto-accepts completed transfers
  const moonshotDepositMutation = useMutation({
    mutationFn: async (data: MoonshotTransfer) => {
      const response = await apiRequest("POST", "/api/treasury/record-token-deposit", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Deposit Automatically Accepted",
        description: data.message || "Tokens successfully recorded in treasury",
      });
      // Reset form
      setTransferData({
        tokenAmount: 0,
        transactionHash: "",
        moonshotAccountId: "",
        notes: ""
      });
      // Refresh treasury data
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/deposits"] });
    },
    onError: (error: any) => {
      toast({
        title: "Deposit Failed",
        description: error.message || "Failed to record deposit",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transferData.transactionHash.trim()) {
      toast({
        title: "Transaction Hash Required",
        description: "Please enter the Moonshot transaction hash",
        variant: "destructive",
      });
      return;
    }

    if (!transferData.tokenAmount || transferData.tokenAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid token amount",
        variant: "destructive",
      });
      return;
    }

    moonshotDepositMutation.mutate(transferData);
  };

  const moonshotDeposits = (depositsData as any)?.deposits?.filter((d: any) => d.depositMethod === 'moonshot') || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Wallet className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Moonshot Funding</h1>
          <p className="text-muted-foreground">Transfer tokens from your Moonshot account to fund JC MOVES rewards</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Transfer Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Transfer from Moonshot
            </CardTitle>
            <CardDescription>
              Transfer tokens from your Moonshot account to fund the JC MOVES treasury
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 mb-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Step 1:</strong> Complete your transfer in Moonshot app first<br/>
                  <strong>Step 2:</strong> Enter the transaction details below to automatically record it
                </p>
              </div>

              <div data-testid="input-token-amount">
                <Label htmlFor="tokenAmount">JCMOVES Token Amount *</Label>
                <Input
                  id="tokenAmount"
                  type="number"
                  step="0.01"
                  placeholder="80640"
                  value={transferData.tokenAmount || ""}
                  onChange={(e) => setTransferData({ ...transferData, tokenAmount: parseFloat(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the exact number of JCMOVES tokens you transferred
                </p>
              </div>

              <div data-testid="input-transaction-hash">
                <Label htmlFor="transactionHash">Transaction Hash/ID *</Label>
                <Input
                  id="transactionHash"
                  placeholder="Enter Moonshot transaction hash"
                  value={transferData.transactionHash}
                  onChange={(e) => setTransferData({ ...transferData, transactionHash: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Copy this from your Moonshot transfer confirmation
                </p>
              </div>

              <div data-testid="input-moonshot-account-id">
                <Label htmlFor="moonshotAccountId">Moonshot Account ID (Optional)</Label>
                <Input
                  id="moonshotAccountId"
                  placeholder="Your Moonshot account ID"
                  value={transferData.moonshotAccountId}
                  onChange={(e) => setTransferData({ ...transferData, moonshotAccountId: e.target.value })}
                />
              </div>

              <div data-testid="input-notes">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes about this transfer..."
                  value={transferData.notes}
                  onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={moonshotDepositMutation.isPending}
                data-testid="button-record-deposit"
              >
                {moonshotDepositMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Recording Deposit...
                  </>
                ) : (
                  "✅ Record & Auto-Accept Deposit"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Live Price & Treasury Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Live Market Price
            </CardTitle>
            <CardDescription>Real-time JCMOVES token pricing</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPrice ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : livePrice ? (
              <div className="space-y-4">
                {/* Live Price Display */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-muted-foreground">{livePrice.symbol}</p>
                    <div className="flex items-center gap-1">
                      {livePrice.change24h !== null && livePrice.change24h > 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-600" data-testid="icon-trending-up" />
                      ) : livePrice.change24h !== null && livePrice.change24h < 0 ? (
                        <TrendingDown className="h-4 w-4 text-red-600" data-testid="icon-trending-down" />
                      ) : null}
                      <span className={`text-sm font-medium ${livePrice.change24h !== null && livePrice.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-price-change">
                        {livePrice.changePercent24h || 'N/A'}
                      </span>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-primary mb-1" data-testid="text-live-price">
                    {livePrice.priceFormatted}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    24h Volume: {livePrice.volumeFormatted || 'N/A'} • Updated: {new Date(livePrice.lastUpdated).toLocaleTimeString()}
                  </p>
                </div>

                {/* Treasury Reserve Info */}
                {treasuryStatus && (
                  <div className="grid grid-cols-2 gap-4">
                    <div data-testid="text-current-market-value">
                      <p className="text-sm text-muted-foreground">Treasury Value</p>
                      <p className="text-xl font-bold text-green-600">
                        ${parseFloat((treasuryStatus as any).stats?.currentMarketValueUsd || '0').toFixed(2)}
                      </p>
                    </div>
                    <div data-testid="text-token-reserve">
                      <p className="text-sm text-muted-foreground">Token Reserve</p>
                      <p className="text-xl font-bold">
                        {parseFloat((treasuryStatus as any).stats?.tokenReserve || '0').toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div data-testid="text-total-funding">
                    <p className="text-sm text-muted-foreground">Total Funding</p>
                    <p className="text-lg font-semibold">
                      ${parseFloat((treasuryStatus as any).stats?.totalFunding || '0').toFixed(2)}
                    </p>
                  </div>
                  <div data-testid="text-total-distributed">
                    <p className="text-sm text-muted-foreground">Total Distributed</p>
                    <p className="text-lg font-semibold">
                      ${parseFloat((treasuryStatus as any).stats?.totalDistributed || '0').toFixed(2)}
                    </p>
                  </div>
                </div>

                {(treasuryStatus as any)?.health && (
                  <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Health Status: {(treasuryStatus as any).health.status}
                    </p>
                    {(treasuryStatus as any).estimatedFundingDays && (
                      <p className="text-sm text-blue-600 dark:text-blue-300">
                        Estimated funding days: {(treasuryStatus as any).estimatedFundingDays.estimatedDays || 'N/A'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-muted-foreground">Unable to load treasury status</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Moonshot Deposits */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Moonshot Transfers</CardTitle>
          <CardDescription>History of transfers from Moonshot accounts</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingDeposits ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : moonshotDeposits.length > 0 ? (
            <div className="space-y-3">
              {moonshotDeposits.slice(0, 10).map((deposit: any) => (
                <div key={deposit.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`deposit-${deposit.id}`}>
                  <div>
                    <p className="font-medium">${parseFloat(deposit.depositAmount).toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(deposit.createdAt).toLocaleDateString()} • {deposit.status}
                    </p>
                    {deposit.moonshotMetadata && (
                      <p className="text-xs text-muted-foreground">
                        {deposit.moonshotMetadata.tokenAmount} {deposit.moonshotMetadata.tokenSymbol}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{deposit.tokensPurchased} JCMOVES</p>
                    {deposit.externalTransactionId && (
                      <p className="text-xs text-muted-foreground font-mono">
                        {deposit.externalTransactionId.slice(0, 16)}...
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No Moonshot transfers yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
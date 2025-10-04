import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wallet, ArrowRightLeft, DollarSign } from "lucide-react";

interface MoonshotTransfer {
  accountId: string;
  tokenSymbol: string;
  tokenAmount: string;
  treasuryAccountId: string;
  notes?: string;
}

export default function AdminMoonshotPage() {
  const { toast } = useToast();
  const [transferData, setTransferData] = useState<MoonshotTransfer>({
    accountId: "",
    tokenSymbol: "SOL",
    tokenAmount: "",
    treasuryAccountId: "",
    notes: ""
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

  // Moonshot deposit mutation
  const moonshotDepositMutation = useMutation({
    mutationFn: async (data: MoonshotTransfer) => {
      const response = await apiRequest("POST", "/api/treasury/moonshot-deposit", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Moonshot Transfer Successful",
        description: data.message || "Tokens successfully transferred from Moonshot account",
      });
      // Reset form
      setTransferData({
        accountId: "",
        tokenSymbol: "SOL", 
        tokenAmount: "",
        treasuryAccountId: "",
        notes: ""
      });
      // Refresh treasury data
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/deposits"] });
    },
    onError: (error: any) => {
      toast({
        title: "Transfer Failed",
        description: error.message || "Failed to process Moonshot transfer",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transferData.accountId.trim()) {
      toast({
        title: "Account ID Required",
        description: "Please enter your Moonshot account ID",
        variant: "destructive",
      });
      return;
    }

    if (!transferData.tokenAmount.trim() || parseFloat(transferData.tokenAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid token amount",
        variant: "destructive",
      });
      return;
    }

    moonshotDepositMutation.mutate(transferData);
  };

  const moonshotDeposits = depositsData?.deposits?.filter((d: any) => d.depositMethod === 'moonshot') || [];

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
              <div data-testid="input-account-id">
                <Label htmlFor="accountId">Moonshot Account ID *</Label>
                <Input
                  id="accountId"
                  placeholder="Enter your Moonshot account ID"
                  value={transferData.accountId}
                  onChange={(e) => setTransferData({ ...transferData, accountId: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div data-testid="input-token-symbol">
                  <Label htmlFor="tokenSymbol">Token</Label>
                  <Input
                    id="tokenSymbol"
                    value={transferData.tokenSymbol}
                    onChange={(e) => setTransferData({ ...transferData, tokenSymbol: e.target.value })}
                  />
                </div>
                
                <div data-testid="input-token-amount">
                  <Label htmlFor="tokenAmount">Amount *</Label>
                  <Input
                    id="tokenAmount"
                    type="number"
                    step="0.000001"
                    placeholder="100.0"
                    value={transferData.tokenAmount}
                    onChange={(e) => setTransferData({ ...transferData, tokenAmount: e.target.value })}
                  />
                </div>
              </div>

              <div data-testid="input-treasury-id">
                <Label htmlFor="treasuryAccountId">Treasury Account ID</Label>
                <Input
                  id="treasuryAccountId"
                  placeholder="Leave empty to use main treasury"
                  value={transferData.treasuryAccountId}
                  onChange={(e) => setTransferData({ ...transferData, treasuryAccountId: e.target.value })}
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
                data-testid="button-transfer"
              >
                {moonshotDepositMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing Transfer...
                  </>
                ) : (
                  "Transfer from Moonshot"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Treasury Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Treasury Status
            </CardTitle>
            <CardDescription>Current treasury funding and reserves</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTreasury ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : treasuryStatus ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div data-testid="text-current-market-value">
                    <p className="text-sm text-muted-foreground">Current Market Value</p>
                    <p className="text-2xl font-bold text-green-600">
                      ${parseFloat(treasuryStatus.stats?.currentMarketValueUsd || '0').toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      @ ${parseFloat(treasuryStatus.stats?.currentTokenPrice || '0').toFixed(8)}
                    </p>
                  </div>
                  <div data-testid="text-token-reserve">
                    <p className="text-sm text-muted-foreground">Token Reserve</p>
                    <p className="text-2xl font-bold">
                      {parseFloat(treasuryStatus.stats?.tokenReserve || '0').toFixed(0)}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div data-testid="text-total-funding">
                    <p className="text-sm text-muted-foreground">Total Funding</p>
                    <p className="text-lg font-semibold">
                      ${parseFloat(treasuryStatus.stats?.totalFunding || '0').toFixed(2)}
                    </p>
                  </div>
                  <div data-testid="text-total-distributed">
                    <p className="text-sm text-muted-foreground">Total Distributed</p>
                    <p className="text-lg font-semibold">
                      ${parseFloat(treasuryStatus.stats?.totalDistributed || '0').toFixed(2)}
                    </p>
                  </div>
                </div>

                {treasuryStatus.health && (
                  <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Health Status: {treasuryStatus.health.status}
                    </p>
                    {treasuryStatus.estimatedFundingDays && (
                      <p className="text-sm text-blue-600 dark:text-blue-300">
                        Estimated funding days: {treasuryStatus.estimatedFundingDays.estimatedDays || 'N/A'}
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
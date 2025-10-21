import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { RefreshCw, ExternalLink, CheckCircle2, AlertCircle, TrendingUp, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function TreasuryMonitor() {
  const { toast } = useToast();

  // Fetch Solscan balance
  const { data: balanceData, isLoading: balanceLoading, refetch: refetchBalance } = useQuery({
    queryKey: ['/api/solscan/balance'],
  });

  // Fetch deposits with verification status
  const { data: depositsData, isLoading: depositsLoading, refetch: refetchDeposits } = useQuery({
    queryKey: ['/api/solscan/deposits'],
  });

  // Sync balance mutation
  const syncBalanceMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/solscan/sync-balance', 'POST', {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "Balance Synced Successfully",
        description: `Updated from ${data.previousBalance?.toLocaleString()} to ${data.newBalance?.toLocaleString()} JCMOVES`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/solscan/balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/treasury/status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync balance from Solscan",
        variant: "destructive",
      });
    },
  });

  const handleSyncBalance = () => {
    syncBalanceMutation.mutate();
  };

  const handleRefresh = () => {
    refetchBalance();
    refetchDeposits();
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Treasury Monitor</h1>
          <p className="text-muted-foreground">
            Real-time blockchain verification via Solscan.io
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={balanceLoading || depositsLoading}
            data-testid="button-refresh-monitor"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={handleSyncBalance}
            disabled={syncBalanceMutation.isPending}
            data-testid="button-sync-balance"
          >
            {syncBalanceMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Database className="h-4 w-4 mr-2" />
            )}
            Sync Balance
          </Button>
        </div>
      </div>

      {/* Balance Card */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card data-testid="card-blockchain-balance">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Blockchain Balance
            </CardTitle>
            <CardDescription>Live balance from Solscan.io</CardDescription>
          </CardHeader>
          <CardContent>
            {balanceLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : balanceData?.balance !== undefined ? (
              <div>
                <p className="text-4xl font-bold text-primary mb-2" data-testid="text-blockchain-balance">
                  {balanceData.balance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className="text-sm text-muted-foreground mb-4">JCMOVES Tokens</p>
                {balanceData.walletAddress && (
                  <a
                    href={`https://solscan.io/account/${balanceData.walletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                    data-testid="link-view-on-solscan"
                  >
                    View on Solscan <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ) : (
              <p className="text-destructive">Failed to load balance</p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-verification-status">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Verification Status
            </CardTitle>
            <CardDescription>Transaction verification summary</CardDescription>
          </CardHeader>
          <CardContent>
            {depositsLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : depositsData ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Total On-Chain</span>
                  <span className="font-bold" data-testid="text-total-onchain">
                    {depositsData.totalOnChain}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Recorded in DB</span>
                  <span className="font-bold text-green-600" data-testid="text-total-recorded">
                    {depositsData.totalRecorded}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Unrecorded</span>
                  <span className="font-bold text-orange-600" data-testid="text-total-unrecorded">
                    {depositsData.unrecorded}
                  </span>
                </div>
                {depositsData.unrecorded > 0 && (
                  <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950 rounded-md">
                    <p className="text-sm text-orange-800 dark:text-orange-200 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      {depositsData.unrecorded} transaction(s) need recording
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-destructive">Failed to load verification data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deposit Transaction History */}
      <Card data-testid="card-deposit-history">
        <CardHeader>
          <CardTitle>Deposit Transaction History</CardTitle>
          <CardDescription>
            JCMOVES token deposits verified on Solana blockchain
          </CardDescription>
        </CardHeader>
        <CardContent>
          {depositsLoading ? (
            <p className="text-muted-foreground">Loading transactions...</p>
          ) : depositsData?.deposits && depositsData.deposits.length > 0 ? (
            <div className="space-y-3">
              {depositsData.deposits.map((deposit: any, index: number) => (
                <div
                  key={deposit.signature}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                  data-testid={`deposit-${index}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant={deposit.recorded ? "default" : "secondary"}
                        data-testid={`badge-status-${index}`}
                      >
                        {deposit.recorded ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Recorded
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Unrecorded
                          </>
                        )}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(deposit.timestamp * 1000), 'MMM dd, yyyy HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm font-mono text-muted-foreground mb-1">
                      From: {deposit.from.slice(0, 8)}...{deposit.from.slice(-6)}
                    </p>
                    <a
                      href={`https://solscan.io/tx/${deposit.signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                      data-testid={`link-tx-${index}`}
                    >
                      {deposit.signature.slice(0, 16)}... <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold" data-testid={`amount-${index}`}>
                      +{deposit.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">JCMOVES</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No deposits found
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

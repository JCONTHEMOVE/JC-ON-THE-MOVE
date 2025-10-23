import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  DollarSign,
  TrendingUp,
  Wallet,
  Send,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Loader2,
  BarChart3,
  Users,
  Activity,
  ExternalLink
} from "lucide-react";

export default function InGodWeTrustPage() {
  const { toast } = useToast();
  const [transferAmount, setTransferAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [depositAmount, setDepositAmount] = useState("");

  // Treasury stats query
  const { data: treasurySummary, refetch: refetchTreasury } = useQuery({
    queryKey: ["/api/treasury/summary"],
  });

  // Live blockchain balance
  const { data: liveBalance, refetch: refetchBalance } = useQuery({
    queryKey: ["/api/solana/balance"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Live token price
  const { data: livePrice } = useQuery({
    queryKey: ["/api/crypto/live-price"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Funding deposits
  const { data: deposits } = useQuery({
    queryKey: ["/api/treasury/deposits"],
  });

  // Admin stats
  const { data: adminStats } = useQuery({
    queryKey: ["/api/admin/stats"],
  });

  // Token transfer mutation
  const transferMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/treasury/transfer", {
        recipientAddress,
        amount: parseFloat(transferAmount),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solana/balance"] });
      refetchBalance();
      setTransferAmount("");
      setRecipientAddress("");
      toast({
        title: "Transfer initiated",
        description: "JCMOVES tokens are being transferred to the recipient wallet.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Transfer failed",
        description: error.message || "Failed to initiate transfer",
        variant: "destructive",
      });
    },
  });

  // Deposit mutation
  const depositMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/treasury/deposit", {
        usdAmount: parseFloat(depositAmount),
        depositMethod: "manual",
        notes: "Manual deposit from IN GOD WE TRUST dashboard",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/deposits"] });
      setDepositAmount("");
      toast({
        title: "Deposit recorded",
        description: "Treasury balance has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Deposit failed",
        description: error.message || "Failed to record deposit",
        variant: "destructive",
      });
    },
  });

  const stats = treasurySummary?.stats || {};
  const tokenPrice = livePrice?.price || stats.currentTokenPrice || 0;
  const blockchainBalance = liveBalance?.balance || 0;
  const databaseBalance = stats.tokenReserve || 0;
  const balanceDiscrepancy = Math.abs(blockchainBalance - databaseBalance);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            IN GOD WE TRUST
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Treasury Management • Blockchain Operations • Business Intelligence
          </p>
        </div>

        {/* Top Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <div className="flex items-center justify-between mb-2">
              <Wallet className="h-8 w-8 opacity-80" />
              <span className="text-sm opacity-80">Live Price</span>
            </div>
            <div className="text-3xl font-bold">${tokenPrice.toFixed(8)}</div>
            <div className="text-sm opacity-80 mt-1">JCMOVES Token</div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-8 w-8 opacity-80" />
              <span className="text-sm opacity-80">Blockchain</span>
            </div>
            <div className="text-3xl font-bold">
              {blockchainBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <div className="text-sm opacity-80 mt-1">JCMOVES Balance</div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-500 to-green-600 text-white">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-8 w-8 opacity-80" />
              <span className="text-sm opacity-80">Treasury</span>
            </div>
            <div className="text-3xl font-bold">
              ${stats.currentMarketValueUsd?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "0"}
            </div>
            <div className="text-sm opacity-80 mt-1">Market Value (USD)</div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-8 w-8 opacity-80" />
              <span className="text-sm opacity-80">System</span>
            </div>
            <div className="text-3xl font-bold">{adminStats?.totalUsers || 0}</div>
            <div className="text-sm opacity-80 mt-1">Total Users</div>
          </Card>
        </div>

        {/* Balance Discrepancy Alert */}
        {balanceDiscrepancy > 100 && (
          <Card className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                  Balance Discrepancy Detected
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Blockchain: {blockchainBalance.toLocaleString()} JCMOVES • Database:{" "}
                  {databaseBalance.toLocaleString()} JCMOVES • Difference:{" "}
                  {balanceDiscrepancy.toLocaleString()} JCMOVES
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                  The blockchain is the source of truth. Database tracking may be incomplete.
                </p>
              </div>
            </div>
          </Card>
        )}

        <Tabs defaultValue="operations" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="operations" data-testid="tab-operations">
              <Activity className="h-4 w-4 mr-2" />
              Operations
            </TabsTrigger>
            <TabsTrigger value="transfers" data-testid="tab-transfers">
              <Send className="h-4 w-4 mr-2" />
              Transfers
            </TabsTrigger>
            <TabsTrigger value="deposits" data-testid="tab-deposits">
              <Upload className="h-4 w-4 mr-2" />
              Deposits
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Operations Tab */}
          <TabsContent value="operations" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Blockchain Verification */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Blockchain Verification
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Treasury Wallet</div>
                    <div className="font-mono text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1 break-all">
                      {liveBalance?.walletAddress || "Not configured"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => refetchBalance()}
                      variant="outline"
                      className="flex-1"
                      data-testid="button-refresh-balance"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      asChild
                      data-testid="button-view-solscan"
                    >
                      <a
                        href={`https://solscan.io/account/${liveBalance?.walletAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View on Solscan
                      </a>
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Treasury Health */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Treasury Health
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Funding</span>
                    <span className="font-semibold">
                      ${stats.totalFunding?.toLocaleString() || "0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Distributed</span>
                    <span className="font-semibold">
                      ${stats.totalDistributed?.toLocaleString() || "0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Available</span>
                    <span className="font-semibold text-green-600">
                      ${stats.availableFunding?.toLocaleString() || "0"}
                    </span>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="flex items-center gap-2">
                      {stats.isHealthy ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-600 font-medium">Healthy</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span className="text-sm text-red-600 font-medium">Critical</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Transfers Tab */}
          <TabsContent value="transfers" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send JCMOVES Tokens
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Transfer JCMOVES tokens directly from the treasury to any Solana wallet address.
                Transfers are recorded on the blockchain and update in real-time.
              </p>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="recipient-address">Recipient Wallet Address</Label>
                  <Input
                    id="recipient-address"
                    placeholder="Solana wallet address (e.g., 7xK...bkK)"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    className="font-mono text-sm"
                    data-testid="input-recipient-address"
                  />
                </div>
                <div>
                  <Label htmlFor="transfer-amount">Amount (JCMOVES)</Label>
                  <Input
                    id="transfer-amount"
                    type="number"
                    placeholder="0.00"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    data-testid="input-transfer-amount"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Available: {blockchainBalance.toLocaleString()} JCMOVES (~$
                    {(blockchainBalance * tokenPrice).toFixed(2)})
                  </p>
                </div>
                <Button
                  onClick={() => transferMutation.mutate()}
                  disabled={
                    transferMutation.isPending ||
                    !transferAmount ||
                    !recipientAddress ||
                    parseFloat(transferAmount) > blockchainBalance
                  }
                  className="w-full"
                  data-testid="button-send-transfer"
                >
                  {transferMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing Transfer...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Transfer
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Deposits Tab */}
          <TabsContent value="deposits" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Record Manual Deposit
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="deposit-amount">USD Amount</Label>
                    <Input
                      id="deposit-amount"
                      type="number"
                      placeholder="0.00"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      data-testid="input-deposit-amount"
                    />
                  </div>
                  <Button
                    onClick={() => depositMutation.mutate()}
                    disabled={depositMutation.isPending || !depositAmount}
                    className="w-full"
                    data-testid="button-record-deposit"
                  >
                    {depositMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Recording...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Record Deposit
                      </>
                    )}
                  </Button>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Recent Deposits
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {deposits?.deposits?.length > 0 ? (
                    deposits.deposits.slice(0, 5).map((deposit: any) => (
                      <div
                        key={deposit.id}
                        className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm"
                      >
                        <div>
                          <div className="font-medium">${parseFloat(deposit.depositAmount).toLocaleString()}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(deposit.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-xs">
                            {parseFloat(deposit.tokensPurchased).toLocaleString()} JCMOVES
                          </div>
                          <div className="text-xs text-gray-500">{deposit.depositMethod}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No recent deposits</p>
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Total Leads
                </h3>
                <div className="text-3xl font-bold">{adminStats?.totalLeads || 0}</div>
              </Card>
              <Card className="p-6">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Active Jobs
                </h3>
                <div className="text-3xl font-bold">{adminStats?.activeJobs || 0}</div>
              </Card>
              <Card className="p-6">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Total Rewards Distributed
                </h3>
                <div className="text-3xl font-bold">
                  ${stats.totalDistributed?.toLocaleString() || "0"}
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

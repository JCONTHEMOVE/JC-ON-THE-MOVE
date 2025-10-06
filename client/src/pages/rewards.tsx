import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RewardsDashboard from '@/components/rewards-dashboard';
import FaucetPage from '@/pages/faucet';

export default function RewardsPage() {
  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-2">Rewards & Crypto Faucet</h1>
        <p className="text-muted-foreground">Earn JCMOVES tokens and cryptocurrency rewards</p>
      </div>

      <Tabs defaultValue="rewards" className="w-full">
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
          <TabsTrigger value="rewards" data-testid="tab-rewards">
            Rewards & Check-ins
          </TabsTrigger>
          <TabsTrigger value="faucet" data-testid="tab-faucet">
            Crypto Faucet
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rewards">
          <RewardsDashboard />
        </TabsContent>

        <TabsContent value="faucet">
          <FaucetPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}

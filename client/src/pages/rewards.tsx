import RewardsDashboard from '@/components/rewards-dashboard';

export default function RewardsPage() {
  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-2">Rewards Center</h1>
        <p className="text-muted-foreground">Earn JCMOVES tokens through daily check-ins and referrals</p>
      </div>

      <RewardsDashboard />
    </div>
  );
}

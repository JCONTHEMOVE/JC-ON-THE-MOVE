import { storage } from '../storage.js';
import { FAUCETPAY_CONFIG } from '../constants.js';

export interface FaucetClaimResult {
  success: boolean;
  currency?: string;
  amount?: string;
  cashValue?: number;
  nextClaimTime?: Date;
  error?: string;
  riskScore?: number;
}

export interface FaucetStatus {
  availableCurrencies: Array<{
    currency: string;
    amount: string;
    canClaim: boolean;
    nextClaimTime?: Date;
    lastClaimTime?: Date;
  }>;
  totalEarnings: {
    [currency: string]: string;
  };
  totalClaims: number;
}

export class FaucetService {
  
  /**
   * Get user's faucet status for all currencies
   */
  async getFaucetStatus(userId: string): Promise<FaucetStatus> {
    try {
      // Get all available currencies from config
      const currencies = FAUCETPAY_CONFIG.DEFAULT_CURRENCIES;
      
      // Get user's faucet wallets
      const userWallets = await storage.getFaucetWalletsByUserId(userId);
      const walletMap = new Map(userWallets.map(w => [w.currency, w]));
      
      // Get recent claims to check cooldowns
      const recentClaims = await storage.getRecentFaucetClaims(userId, 24); // Last 24 hours
      const claimMap = new Map(recentClaims.map(c => [c.currency, c]));
      
      const availableCurrencies = currencies.map(currency => {
        const wallet = walletMap.get(currency);
        const lastClaim = claimMap.get(currency);
        const amount = FAUCETPAY_CONFIG.DEFAULT_REWARDS[currency as keyof typeof FAUCETPAY_CONFIG.DEFAULT_REWARDS]?.toString() || "0";
        
        // Check if user can claim (1 hour cooldown)
        const canClaim = !lastClaim || 
          (Date.now() - new Date(lastClaim.claimTime).getTime()) >= (FAUCETPAY_CONFIG.DEFAULT_CLAIM_INTERVAL * 1000);
        
        const nextClaimTime = lastClaim ? 
          new Date(new Date(lastClaim.claimTime).getTime() + (FAUCETPAY_CONFIG.DEFAULT_CLAIM_INTERVAL * 1000)) : 
          undefined;
        
        return {
          currency,
          amount,
          canClaim,
          nextClaimTime: canClaim ? undefined : nextClaimTime,
          lastClaimTime: lastClaim ? new Date(lastClaim.claimTime) : undefined
        };
      });
      
      // Calculate total earnings
      const totalEarnings: { [currency: string]: string } = {};
      userWallets.forEach(wallet => {
        totalEarnings[wallet.currency] = wallet.totalEarned;
      });
      
      // Calculate total claims
      const totalClaims = userWallets.reduce((sum, wallet) => sum + (wallet.totalClaims || 0), 0);
      
      return {
        availableCurrencies,
        totalEarnings,
        totalClaims
      };
    } catch (error) {
      console.error('Faucet status error:', error);
      return {
        availableCurrencies: [],
        totalEarnings: {},
        totalClaims: 0
      };
    }
  }
  
  /**
   * Process a faucet claim for a specific currency
   */
  async claimFaucetReward(
    userId: string, 
    currency: string, 
    userAgent?: string,
    ipAddress?: string
  ): Promise<FaucetClaimResult> {
    try {
      // Validate currency
      if (!FAUCETPAY_CONFIG.DEFAULT_CURRENCIES.includes(currency)) {
        return {
          success: false,
          error: `Unsupported currency: ${currency}`
        };
      }
      
      // Check recent claims for cooldown
      const recentClaims = await storage.getRecentFaucetClaims(userId, 24);
      const lastClaimForCurrency = recentClaims.find(claim => claim.currency === currency);
      
      if (lastClaimForCurrency) {
        const timeSinceLastClaim = Date.now() - new Date(lastClaimForCurrency.claimTime).getTime();
        const cooldownTime = FAUCETPAY_CONFIG.DEFAULT_CLAIM_INTERVAL * 1000; // Convert to milliseconds
        
        if (timeSinceLastClaim < cooldownTime) {
          const nextClaimTime = new Date(new Date(lastClaimForCurrency.claimTime).getTime() + cooldownTime);
          return {
            success: false,
            error: `Please wait ${Math.ceil((cooldownTime - timeSinceLastClaim) / 60000)} minutes before claiming ${currency} again`,
            nextClaimTime
          };
        }
      }
      
      // Calculate anti-abuse risk score
      const riskScore = await this.calculateRiskScore(userId, ipAddress);
      
      if (riskScore > FAUCETPAY_CONFIG.RISK_SCORE_THRESHOLD) {
        return {
          success: false,
          error: "Claim blocked due to suspicious activity",
          riskScore
        };
      }
      
      // Get reward amount
      const rewardAmount = FAUCETPAY_CONFIG.DEFAULT_REWARDS[currency as keyof typeof FAUCETPAY_CONFIG.DEFAULT_REWARDS];
      if (!rewardAmount) {
        return {
          success: false,
          error: `No reward configured for ${currency}`
        };
      }
      
      // Estimate cash value (simplified)
      const cashValue = this.estimateCashValue(currency, rewardAmount);
      
      // Create faucet claim record
      const claim = await storage.createFaucetClaim({
        userId,
        currency,
        rewardAmount: rewardAmount.toString(),
        cashValue: cashValue.toString(),
        ipAddress,
        userAgent,
        riskScore,
        status: 'paid', // For now, mark as paid immediately
        metadata: {
          source: 'internal_faucet',
          timestamp: Date.now()
        }
      });
      
      // Create or update user's faucet wallet
      await this.updateUserFaucetWallet(userId, currency, rewardAmount);
      
      // Calculate next claim time
      const nextClaimTime = new Date(Date.now() + (FAUCETPAY_CONFIG.DEFAULT_CLAIM_INTERVAL * 1000));
      
      return {
        success: true,
        currency,
        amount: rewardAmount.toString(),
        cashValue,
        nextClaimTime,
        riskScore
      };
      
    } catch (error) {
      console.error('Faucet claim error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process claim"
      };
    }
  }
  
  /**
   * Calculate risk score for anti-abuse
   */
  private async calculateRiskScore(userId: string, ipAddress?: string): Promise<number> {
    let riskScore = 0;
    
    try {
      // Check daily claim frequency
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const todayClaims = await storage.getFaucetClaimsSince(userId, todayStart);
      
      // Risk factors
      if (todayClaims.length > 10) riskScore += 30; // Many claims today
      if (todayClaims.length > 20) riskScore += 40; // Excessive claims
      
      // IP-based checks (if provided)
      if (ipAddress) {
        const ipClaims = await storage.getFaucetClaimsByIP(ipAddress, 1); // Last hour
        if (ipClaims.length > FAUCETPAY_CONFIG.MAX_CLAIMS_PER_IP_PER_HOUR) {
          riskScore += 50;
        }
      }
      
      return Math.min(riskScore, 100); // Cap at 100
    } catch (error) {
      console.error('Risk calculation error:', error);
      return 0; // Default to safe score
    }
  }
  
  /**
   * Estimate cash value of cryptocurrency reward
   */
  private estimateCashValue(currency: string, amount: number): number {
    // Simplified estimation - in production, you'd use real-time prices
    const estimates = {
      BTC: 0.025, // 50 satoshis ≈ $0.025
      ETH: 0.003, // 1000 gwei ≈ $0.003
      LTC: 0.001, // 10000 litoshi ≈ $0.001
      DOGE: 0.10,  // 1M koinu ≈ $0.10
    };
    
    return estimates[currency as keyof typeof estimates] || 0.001;
  }
  
  /**
   * Update user's faucet wallet with new earnings
   */
  private async updateUserFaucetWallet(userId: string, currency: string, amount: number): Promise<void> {
    try {
      const existingWallet = await storage.getFaucetWalletByUserCurrency(userId, currency);
      
      if (existingWallet) {
        // Update existing wallet
        await storage.updateFaucetWallet(existingWallet.id, {
          totalEarned: (parseFloat(existingWallet.totalEarned) + amount).toString(),
          totalClaims: (existingWallet.totalClaims || 0) + 1,
          lastClaimTime: new Date()
        });
      } else {
        // Create new wallet
        await storage.createFaucetWallet({
          userId,
          currency,
          totalEarned: amount.toString(),
          totalClaims: 1,
          lastClaimTime: new Date()
        });
      }
    } catch (error) {
      console.error('Faucet wallet update error:', error);
    }
  }
}

export const faucetService = new FaucetService();
import { storage } from '../storage.js';
import { FAUCET_CONFIG } from '../constants.js';
import { getFaucetPayService } from './faucetpay.js';

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
      const currencies = FAUCET_CONFIG.DEFAULT_CURRENCIES;
      
      // Get user's faucet wallets for all currencies
      const userWallets = [];
      for (const currency of currencies) {
        const wallet = await storage.getFaucetWallet(userId, currency);
        if (wallet) userWallets.push(wallet);
      }
      const walletMap = new Map(userWallets.map(w => [w.currency, w]));
      
      // Get recent claims to check cooldowns  
      const recentClaims = await storage.getFaucetClaims(userId, undefined, 24); // Last 24 hours
      const claimMap = new Map(recentClaims.map(c => [c.currency, c]));
      
      const availableCurrencies = await Promise.all(currencies.map(async (currency) => {
        const wallet = walletMap.get(currency);
        const lastClaim = claimMap.get(currency);
        let amount = "0";
        if (FAUCET_CONFIG.MODE === 'DEMO') {
          amount = FAUCET_CONFIG.DEMO_REWARDS[currency as keyof typeof FAUCET_CONFIG.DEMO_REWARDS]?.toString() || "0";
        } else if (FAUCET_CONFIG.MODE === 'FAUCETPAY') {
          // For FaucetPay, get amount from database config
          const configs = await storage.getFaucetConfig(currency);
          amount = configs.length > 0 ? configs[0].rewardAmount : "0";
        } else {
          amount = FAUCET_CONFIG.SELF_FUNDED_REWARDS[currency as keyof typeof FAUCET_CONFIG.SELF_FUNDED_REWARDS]?.toString() || "0";
        }
        
        // Check if user can claim (1 hour cooldown)
        const canClaim = !lastClaim || 
          (Date.now() - new Date(lastClaim.createdAt).getTime()) >= (FAUCET_CONFIG.DEFAULT_CLAIM_INTERVAL * 1000);
        
        const nextClaimTime = lastClaim ? 
          new Date(new Date(lastClaim.createdAt).getTime() + (FAUCET_CONFIG.DEFAULT_CLAIM_INTERVAL * 1000)) : 
          undefined;
        
        return {
          currency,
          amount,
          canClaim,
          nextClaimTime: canClaim ? undefined : nextClaimTime,
          lastClaimTime: lastClaim ? new Date(lastClaim.createdAt) : undefined
        };
      }));
      
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
      if (!FAUCET_CONFIG.DEFAULT_CURRENCIES.includes(currency)) {
        return {
          success: false,
          error: `Unsupported currency: ${currency}`
        };
      }
      
      // Check recent claims for cooldown
      const recentClaims = await storage.getFaucetClaims(userId, undefined, 24);
      const lastClaimForCurrency = recentClaims.find(claim => claim.currency === currency);
      
      if (lastClaimForCurrency) {
        const timeSinceLastClaim = Date.now() - new Date(lastClaimForCurrency.createdAt).getTime();
        const cooldownTime = FAUCET_CONFIG.DEFAULT_CLAIM_INTERVAL * 1000; // Convert to milliseconds
        
        if (timeSinceLastClaim < cooldownTime) {
          const nextClaimTime = new Date(new Date(lastClaimForCurrency.claimTime).getTime() + cooldownTime);
          return {
            success: false,
            error: `Please wait ${Math.ceil((cooldownTime - timeSinceLastClaim) / 60000)} minutes before claiming ${currency} again`,
            nextClaimTime
          };
        }
      }
      
      // Check anti-abuse limits first
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dailyClaimsCount = await storage.getFaucetClaims(userId, undefined, 100);
      if (dailyClaimsCount.length >= FAUCET_CONFIG.ABUSE_PROTECTION.MAX_CLAIMS_PER_USER_PER_DAY) {
        return {
          success: false,
          error: "Daily claim limit reached. Please try again tomorrow."
        };
      }

      // Check IP-based limits only if we have a valid IP
      if (ipAddress && ipAddress !== 'unknown') {
        const ipClaims = await storage.getFaucetClaimsByIP(ipAddress, 1);
        if (ipClaims.length >= FAUCET_CONFIG.ABUSE_PROTECTION.MAX_CLAIMS_PER_IP_PER_HOUR) {
          return {
            success: false,
            error: "Too many claims from this location. Please try again later."
          };
        }
      }

      // Calculate anti-abuse risk score
      const riskScore = await this.calculateRiskScore(userId, ipAddress);
      
      if (riskScore > FAUCET_CONFIG.ABUSE_PROTECTION.RISK_SCORE_THRESHOLD) {
        return {
          success: false,
          error: "Claim blocked due to suspicious activity",
          riskScore
        };
      }
      
      // Get reward amount
      // Get reward amount based on mode
      let rewardAmount: number;
      if (FAUCET_CONFIG.MODE === 'DEMO') {
        rewardAmount = FAUCET_CONFIG.DEMO_REWARDS[currency as keyof typeof FAUCET_CONFIG.DEMO_REWARDS];
      } else if (FAUCET_CONFIG.MODE === 'FAUCETPAY') {
        // For FaucetPay, get reward from config table (stored in database)
        const configs = await storage.getFaucetConfig(currency);
        if (!configs.length || !configs[0].isEnabled) {
          return {
            success: false,
            error: `${currency} faucet is not available`
          };
        }
        rewardAmount = parseFloat(configs[0].rewardAmount);
      } else {
        rewardAmount = FAUCET_CONFIG.SELF_FUNDED_REWARDS[currency as keyof typeof FAUCET_CONFIG.SELF_FUNDED_REWARDS];
      }
      if (!rewardAmount) {
        return {
          success: false,
          error: `No reward configured for ${currency}`
        };
      }
      
      // Estimate cash value (simplified)
      const cashValue = this.estimateCashValue(currency, rewardAmount);
      
      let payout_id: number | null = null;
      let payout_user_hash: string | null = null;
      
      // Process payment based on mode
      if (FAUCET_CONFIG.MODE === 'FAUCETPAY') {
        const faucetPayService = getFaucetPayService();
        if (!faucetPayService) {
          return {
            success: false,
            error: "FaucetPay service is not configured. Please contact support."
          };
        }

        try {
          // Get user's FaucetPay address (this should be stored in user profile or wallet)
          const userWallet = await storage.getFaucetWallet(userId, currency);
          if (!userWallet?.faucetpayAddress) {
            return {
              success: false,
              error: `Please set your ${currency} FaucetPay address in your profile first.`
            };
          }

          // Send payment via FaucetPay
          const paymentResult = await faucetPayService.sendPayment({
            amount: rewardAmount,
            to: userWallet.faucetpayAddress,
            currency,
            ipAddress,
            referral: false
          });

          payout_id = paymentResult.payout_id;
          payout_user_hash = paymentResult.payout_user_hash;
          
        } catch (paymentError: any) {
          console.error('FaucetPay payment failed:', paymentError);
          return {
            success: false,
            error: `Payment failed: ${paymentError.message}`
          };
        }
      }

      // Create faucet claim record
      const claim = await storage.createFaucetClaim({
        userId,
        currency,
        rewardAmount: rewardAmount.toString(),
        cashValue: cashValue.toString(),
        ipAddress,
        userAgent,
        faucetpayPayoutId: payout_id?.toString(),
        faucetpayUserHash: payout_user_hash,
        status: FAUCET_CONFIG.MODE === 'FAUCETPAY' ? 'paid' : 'pending',
        metadata: {
          source: 'faucetpay_integration',
          mode: FAUCET_CONFIG.MODE,
          payout_id,
          timestamp: Date.now()
        }
      });
      
      // Create or update user's faucet wallet
      await this.updateUserFaucetWallet(userId, currency, rewardAmount);
      
      // Calculate next claim time
      const nextClaimTime = new Date(Date.now() + (FAUCET_CONFIG.DEFAULT_CLAIM_INTERVAL * 1000));
      
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
        if (ipClaims.length > FAUCET_CONFIG.ABUSE_PROTECTION.MAX_CLAIMS_PER_IP_PER_HOUR) {
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
    // Calculate USD value based on configured demo amounts and target values
    // Demo rewards are: BTC:200 satoshi→$0.10, ETH:3000 gwei→$0.009, LTC:30000 litoshi→$0.003, DOGE:3000000 koinu→$0.30
    const usdPerUnit = {
      BTC: 0.10 / 200,     // $0.0005 per satoshi
      ETH: 0.009 / 3000,   // $0.000003 per gwei
      LTC: 0.003 / 30000,  // $0.0000001 per litoshi  
      DOGE: 0.30 / 3000000, // $0.0000001 per koinu
    };
    
    const rate = usdPerUnit[currency as keyof typeof usdPerUnit];
    return rate ? amount * rate : 0.001;
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
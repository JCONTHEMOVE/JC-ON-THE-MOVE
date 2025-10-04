// Central configuration for treasury and rewards system
export const TREASURY_CONFIG = {
  // JCMOVES Cryptocurrency Configuration
  TOKEN_ADDRESS: process.env.MOONSHOT_TOKEN_ADDRESS || 'BHZW4jds7NSe5Fqvw9Z4pvt423EJSx63k8MT11F2moon',
  TOKEN_SYMBOL: 'JCMOVES',
  TOKEN_NAME: 'JCMOVES Token',
  
  // Dynamic pricing (replaced fixed price with crypto pricing)
  // TOKEN_PRICE: Uses real-time JCMOVES market price from crypto service
  FALLBACK_TOKEN_PRICE: 0.000005034116, // Real Moonshot price as emergency fallback
  
  // Safety thresholds (in USD)
  MINIMUM_BALANCE: 1.0, // $1 minimum balance
  WARNING_THRESHOLD: 100.0, // Warn when below $100 (increased for crypto volatility)
  CRITICAL_THRESHOLD: 25.0, // Critical alert when below $25
  
  // Reward amounts (USD values converted to current JCMOVES tokens)
  SIGNUP_BONUS_USD: 5.00, // $5.00 worth of JCMOVES for new users
  DAILY_CHECKIN_USD: 0.25, // $0.25 worth of JCMOVES per daily check-in
  REFERRAL_BONUS_USD: 10.00, // $10.00 worth of JCMOVES per successful referral
  JOB_COMPLETION_USD: 2.50, // $2.50 worth of JCMOVES per job completed per mover
  
  // Volatility management
  MAX_PRICE_VOLATILITY: 25, // Maximum 25% price change before adjusting operations
  PRICE_UPDATE_INTERVAL: 30000, // 30 seconds between price updates
  
  // Business rules
  MAX_DAILY_CHECKIN_STREAK: 365, // Maximum streak tracking
  FRAUD_THRESHOLD_SCORE: 75, // Block actions above this risk score
  
  // Crypto-specific settings
  ENABLE_REAL_CRYPTO: true, // Toggle for crypto vs internal tokens
  MIN_WITHDRAWAL_TOKENS: 100, // Minimum JCMOVES for withdrawal
  WITHDRAWAL_FEE_PERCENT: 2, // 2% fee for crypto withdrawals
} as const;

export const REWARD_TYPES = {
  SIGNUP_BONUS: 'signup_bonus',
  DAILY_CHECKIN: 'daily_checkin', 
  JOB_COMPLETION: 'job_completion',
  REFERRAL_BONUS: 'referral_bonus',
} as const;

export const FAUCET_CONFIG = {
  // Faucet operation mode - PRODUCTION MODE ENABLED!
  MODE: 'FAUCETPAY', // 'FAUCETPAY' | 'SELF_FUNDED' | 'DEMO'
  
  // Default faucet settings
  DEFAULT_CURRENCIES: ['BTC', 'ETH', 'LTC', 'DOGE'],
  DEFAULT_CLAIM_INTERVAL: 3600, // 1 hour in seconds
  
  // Self-funded reward amounts (reasonable starting amounts)
  SELF_FUNDED_REWARDS: {
    BTC: 100, // 100 satoshis (~$0.05 at $50k BTC)
    ETH: 2000, // 2000 gwei (~$0.006 at $3k ETH)  
    LTC: 20000, // 20000 litoshi (~$0.002 at $100 LTC)
    DOGE: 2000000, // 2M koinu (~$0.20 at $0.10 DOGE)
  },
  
  // Wallet management
  WALLET_CONFIG: {
    // Minimum balance alerts (in USD equivalent)
    LOW_BALANCE_WARNING: 10.0, // Warn when wallet below $10
    CRITICAL_BALANCE_ALERT: 5.0, // Alert when below $5
    
    // Transaction settings
    MAX_DAILY_PAYOUTS_USD: 50.0, // Daily limit to prevent abuse
    TRANSACTION_FEE_BUFFER: 1.5, // 1.5x estimated fees for safety
  },
  
  // Anti-abuse settings (stricter for self-funded)
  ABUSE_PROTECTION: {
    MAX_CLAIMS_PER_IP_PER_HOUR: 3, // Reduced for self-funded
    MAX_CLAIMS_PER_USER_PER_DAY: 12, // One every 2 hours max
    RISK_SCORE_THRESHOLD: 60, // Lower threshold for better protection
  },
  
  // Demo mode settings (small realistic amounts that align with cash estimates)
  DEMO_REWARDS: {
    BTC: 200, // 200 satoshi = ~$0.10
    ETH: 3000, // 3000 gwei = ~$0.009  
    LTC: 30000, // 30000 litoshi = ~$0.003
    DOGE: 3000000, // 3M koinu = ~$0.30
  }
};
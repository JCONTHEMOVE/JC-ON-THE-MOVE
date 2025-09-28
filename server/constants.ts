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
  MINIMUM_BALANCE: 50.0, // $50 minimum balance (increased for crypto volatility)
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

export const FAUCETPAY_CONFIG = {
  // Default faucet settings
  DEFAULT_CURRENCIES: ['BTC', 'ETH', 'LTC', 'DOGE'],
  DEFAULT_CLAIM_INTERVAL: 3600, // 1 hour in seconds
  
  // Reward amounts in smallest units (satoshis, gwei, etc.)
  DEFAULT_REWARDS: {
    BTC: 50, // 50 satoshis (~$0.025 at $50k BTC)
    ETH: 1000, // 1000 gwei (~$0.003 at $3k ETH)
    LTC: 10000, // 10000 litoshi (~$0.001 at $100 LTC)
    DOGE: 1000000, // 1M koinu (~$0.10 at $0.10 DOGE)
  },
  
  // Anti-abuse settings
  MAX_CLAIMS_PER_IP_PER_HOUR: 5,
  MAX_CLAIMS_PER_USER_PER_DAY: 24, // One per hour max
  RISK_SCORE_THRESHOLD: 75, // Block claims above this risk score
  
  // Revenue tracking
  ESTIMATED_AD_REVENUE_PER_CLAIM: 0.001, // $0.001 estimated revenue per claim
  REVENUE_SHARE_PERCENTAGE: 0.30, // 30% of ad revenue goes to users
};
// Central configuration for treasury and rewards system
export const TREASURY_CONFIG = {
  // JCMOVES Cryptocurrency Configuration
  TOKEN_ADDRESS: process.env.MOONSHOT_TOKEN_ADDRESS || 'BHZW4jds7NSe5Fqvw9Z4pvt423EJSx63k8MT11F2moon',
  TOKEN_SYMBOL: 'JCMOVES',
  TOKEN_NAME: 'JCMOVES Token',
  
  // Dynamic pricing (replaced fixed price with crypto pricing)
  // TOKEN_PRICE: Uses real-time JCMOVES market price from crypto service
  FALLBACK_TOKEN_PRICE: 0.001, // Emergency fallback if all APIs fail
  
  // Safety thresholds (in USD)
  MINIMUM_BALANCE: 50.0, // $50 minimum balance (increased for crypto volatility)
  WARNING_THRESHOLD: 100.0, // Warn when below $100 (increased for crypto volatility)
  CRITICAL_THRESHOLD: 25.0, // Critical alert when below $25
  
  // Reward amounts (fixed token amounts - real JCMOVES)
  SIGNUP_BONUS_TOKENS: 1000, // 1,000 JCMOVES for new users
  DAILY_CHECKIN_TOKENS: 10, // 10 JCMOVES per daily check-in
  
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
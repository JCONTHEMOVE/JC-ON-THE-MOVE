// Central configuration for treasury and rewards system
export const TREASURY_CONFIG = {
  // Token economics
  TOKEN_PRICE: 0.001, // $0.001 per JCMOVE token
  
  // Safety thresholds  
  MINIMUM_BALANCE: 10.0, // $10 minimum balance to continue operations
  WARNING_THRESHOLD: 50.0, // Warn when below $50
  
  // Reward amounts
  SIGNUP_BONUS_TOKENS: 1000, // 1,000 tokens for new users
  DAILY_CHECKIN_TOKENS: 10, // 10 tokens per daily check-in
  
  // Business rules
  MAX_DAILY_CHECKIN_STREAK: 365, // Maximum streak tracking
  FRAUD_THRESHOLD_SCORE: 75, // Block actions above this risk score
} as const;

export const REWARD_TYPES = {
  SIGNUP_BONUS: 'signup_bonus',
  DAILY_CHECKIN: 'daily_checkin', 
  JOB_COMPLETION: 'job_completion',
  REFERRAL_BONUS: 'referral_bonus',
} as const;
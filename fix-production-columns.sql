-- Fix all text columns that should be numeric in production database
-- Run this with: psql $DATABASE_URL -f fix-production-columns.sql

-- Convert wallet_transactions.amount
ALTER TABLE wallet_transactions 
ALTER COLUMN amount TYPE DECIMAL(18,8) 
USING (
  CASE 
    WHEN amount IS NULL THEN 0
    WHEN LENGTH(amount) = 0 THEN 0
    WHEN amount ~ '^-?[0-9]+\.?[0-9]*$' THEN amount::numeric(18,8)
    ELSE 0
  END
);

-- Convert wallet_transactions.balance_after
ALTER TABLE wallet_transactions 
ALTER COLUMN balance_after TYPE DECIMAL(18,8) 
USING (
  CASE 
    WHEN balance_after IS NULL THEN 0
    WHEN LENGTH(balance_after) = 0 THEN 0
    WHEN balance_after ~ '^-?[0-9]+\.?[0-9]*$' THEN balance_after::numeric(18,8)
    ELSE 0
  END
);

-- Convert user_wallets.balance
ALTER TABLE user_wallets 
ALTER COLUMN balance TYPE DECIMAL(18,8) 
USING (
  CASE 
    WHEN balance IS NULL THEN 0
    WHEN LENGTH(balance) = 0 THEN 0
    WHEN balance ~ '^-?[0-9]+\.?[0-9]*$' THEN balance::numeric(18,8)
    ELSE 0
  END
);

-- Convert achievement_types.token_reward
ALTER TABLE achievement_types 
ALTER COLUMN token_reward TYPE DECIMAL(18,8) 
USING (
  CASE 
    WHEN token_reward IS NULL THEN 0
    WHEN LENGTH(token_reward) = 0 THEN 0
    WHEN token_reward ~ '^-?[0-9]+\.?[0-9]*$' THEN token_reward::numeric(18,8)
    ELSE 0
  END
);

-- Convert supported_currencies.minimum_balance
ALTER TABLE supported_currencies 
ALTER COLUMN minimum_balance TYPE DECIMAL(18,8) 
USING (
  CASE 
    WHEN minimum_balance IS NULL THEN 0
    WHEN LENGTH(minimum_balance) = 0 THEN 0
    WHEN minimum_balance ~ '^-?[0-9]+\.?[0-9]*$' THEN minimum_balance::numeric(18,8)
    ELSE 0
  END
);

-- Convert supported_currencies.withdrawal_fee_percent
ALTER TABLE supported_currencies 
ALTER COLUMN withdrawal_fee_percent TYPE NUMERIC(5,2) 
USING (
  CASE 
    WHEN withdrawal_fee_percent IS NULL THEN 0
    WHEN LENGTH(withdrawal_fee_percent) = 0 THEN 0
    WHEN withdrawal_fee_percent ~ '^-?[0-9]+\.?[0-9]*$' THEN withdrawal_fee_percent::numeric(5,2)
    ELSE 0
  END
);

-- Fix all text columns that should be numeric in production database
-- Run this with: psql $DATABASE_URL -f fix-production-columns.sql

-- Convert wallet_transactions.amount
ALTER TABLE wallet_transactions 
ALTER COLUMN amount TYPE DECIMAL(18,8) 
USING (
  CASE 
    WHEN amount IS NULL THEN 0
    WHEN TRIM(amount) = '' THEN 0
    WHEN TRIM(amount) ~ '^-?[0-9]+\.?[0-9]*$' THEN TRIM(amount)::numeric(18,8)
    ELSE 0
  END
);

-- Convert wallet_transactions.balance_after
ALTER TABLE wallet_transactions 
ALTER COLUMN balance_after TYPE DECIMAL(18,8) 
USING (
  CASE 
    WHEN balance_after IS NULL THEN 0
    WHEN TRIM(balance_after) = '' THEN 0
    WHEN TRIM(balance_after) ~ '^-?[0-9]+\.?[0-9]*$' THEN TRIM(balance_after)::numeric(18,8)
    ELSE 0
  END
);

-- Convert user_wallets.balance
ALTER TABLE user_wallets 
ALTER COLUMN balance TYPE DECIMAL(18,8) 
USING (
  CASE 
    WHEN balance IS NULL THEN 0
    WHEN TRIM(balance) = '' THEN 0
    WHEN TRIM(balance) ~ '^-?[0-9]+\.?[0-9]*$' THEN TRIM(balance)::numeric(18,8)
    ELSE 0
  END
);

-- Convert achievement_types.token_reward
ALTER TABLE achievement_types 
ALTER COLUMN token_reward TYPE DECIMAL(18,8) 
USING (
  CASE 
    WHEN token_reward IS NULL THEN 0
    WHEN TRIM(token_reward) = '' THEN 0
    WHEN TRIM(token_reward) ~ '^-?[0-9]+\.?[0-9]*$' THEN TRIM(token_reward)::numeric(18,8)
    ELSE 0
  END
);

-- Convert supported_currencies.minimum_balance
ALTER TABLE supported_currencies 
ALTER COLUMN minimum_balance TYPE DECIMAL(18,8) 
USING (
  CASE 
    WHEN minimum_balance IS NULL THEN 0
    WHEN TRIM(minimum_balance) = '' THEN 0
    WHEN TRIM(minimum_balance) ~ '^-?[0-9]+\.?[0-9]*$' THEN TRIM(minimum_balance)::numeric(18,8)
    ELSE 0
  END
);

-- Convert supported_currencies.withdrawal_fee_percent
ALTER TABLE supported_currencies 
ALTER COLUMN withdrawal_fee_percent TYPE NUMERIC(5,2) 
USING (
  CASE 
    WHEN withdrawal_fee_percent IS NULL THEN 0
    WHEN TRIM(withdrawal_fee_percent) = '' THEN 0
    WHEN TRIM(withdrawal_fee_percent) ~ '^-?[0-9]+\.?[0-9]*$' THEN TRIM(withdrawal_fee_percent)::numeric(5,2)
    ELSE 0
  END
);

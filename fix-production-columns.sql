-- Fix all text columns that should be numeric in production database
-- Run this with: psql $DATABASE_URL -f fix-production-columns.sql

-- Fix wallet_transactions.amount
ALTER TABLE wallet_transactions ALTER COLUMN amount TYPE DECIMAL(18,8) 
USING CASE 
  WHEN amount IS NULL OR amount = '' THEN 0 
  WHEN amount ~ '^[0-9.]+$' THEN amount::numeric(18,8)
  ELSE 0 
END;

-- Fix wallet_transactions.balance_after
ALTER TABLE wallet_transactions ALTER COLUMN balance_after TYPE DECIMAL(18,8) 
USING CASE 
  WHEN balance_after IS NULL OR balance_after = '' THEN 0 
  WHEN balance_after ~ '^[0-9.]+$' THEN balance_after::numeric(18,8)
  ELSE 0 
END;

-- Fix user_wallets.balance
ALTER TABLE user_wallets ALTER COLUMN balance TYPE DECIMAL(18,8) 
USING CASE 
  WHEN balance IS NULL OR balance = '' THEN 0 
  WHEN balance ~ '^[0-9.]+$' THEN balance::numeric(18,8)
  ELSE 0 
END;

-- Fix achievement_types.token_reward
ALTER TABLE achievement_types ALTER COLUMN token_reward TYPE DECIMAL(18,8) 
USING CASE 
  WHEN token_reward IS NULL OR token_reward = '' THEN 0 
  WHEN token_reward ~ '^[0-9.]+$' THEN token_reward::numeric(18,8)
  ELSE 0 
END;

-- Fix supported_currencies.minimum_balance
ALTER TABLE supported_currencies ALTER COLUMN minimum_balance TYPE DECIMAL(18,8) 
USING CASE 
  WHEN minimum_balance IS NULL OR minimum_balance = '' THEN 0 
  WHEN minimum_balance ~ '^[0-9.]+$' THEN minimum_balance::numeric(18,8)
  ELSE 0 
END;

-- Fix supported_currencies.withdrawal_fee_percent
ALTER TABLE supported_currencies ALTER COLUMN withdrawal_fee_percent TYPE NUMERIC(5,2) 
USING CASE 
  WHEN withdrawal_fee_percent IS NULL OR withdrawal_fee_percent = '' THEN 0 
  WHEN withdrawal_fee_percent ~ '^[0-9.]+$' THEN withdrawal_fee_percent::numeric(5,2)
  ELSE 0 
END;

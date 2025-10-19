-- Fix all text columns that should be numeric in production database
-- Run this with: psql $DATABASE_URL -f fix-production-columns.sql

-- Fix wallet_transactions columns
ALTER TABLE wallet_transactions ALTER COLUMN amount DROP DEFAULT;
ALTER TABLE wallet_transactions ALTER COLUMN amount TYPE DECIMAL(18,8) USING CASE WHEN amount = '' OR amount IS NULL THEN 0 ELSE amount::numeric(18,8) END;

ALTER TABLE wallet_transactions ALTER COLUMN balance_after DROP DEFAULT;
ALTER TABLE wallet_transactions ALTER COLUMN balance_after TYPE DECIMAL(18,8) USING CASE WHEN balance_after = '' OR balance_after IS NULL THEN 0 ELSE balance_after::numeric(18,8) END;

-- Fix user_wallets column
ALTER TABLE user_wallets ALTER COLUMN balance DROP DEFAULT;
ALTER TABLE user_wallets ALTER COLUMN balance TYPE DECIMAL(18,8) USING CASE WHEN balance = '' OR balance IS NULL THEN 0 ELSE balance::numeric(18,8) END;

-- Fix achievement_types column
ALTER TABLE achievement_types ALTER COLUMN token_reward DROP DEFAULT;
ALTER TABLE achievement_types ALTER COLUMN token_reward TYPE DECIMAL(18,8) USING CASE WHEN token_reward = '' OR token_reward IS NULL THEN 0 ELSE token_reward::numeric(18,8) END;

-- Fix supported_currencies columns
ALTER TABLE supported_currencies ALTER COLUMN minimum_balance DROP DEFAULT;
ALTER TABLE supported_currencies ALTER COLUMN minimum_balance TYPE DECIMAL(18,8) USING CASE WHEN minimum_balance = '' OR minimum_balance IS NULL THEN 0 ELSE minimum_balance::numeric(18,8) END;

ALTER TABLE supported_currencies ALTER COLUMN withdrawal_fee_percent DROP DEFAULT;
ALTER TABLE supported_currencies ALTER COLUMN withdrawal_fee_percent TYPE NUMERIC(5,2) USING CASE WHEN withdrawal_fee_percent = '' OR withdrawal_fee_percent IS NULL THEN 0 ELSE withdrawal_fee_percent::numeric(5,2) END;

-- Fix all text columns that should be numeric in production database
-- Run this with: psql $DATABASE_URL -f fix-production-columns.sql

-- Step 1: Replace empty strings with NULL for all columns
UPDATE wallet_transactions SET amount = NULL WHERE amount = '';
UPDATE wallet_transactions SET balance_after = NULL WHERE balance_after = '';
UPDATE user_wallets SET balance = NULL WHERE balance = '';
UPDATE achievement_types SET token_reward = NULL WHERE token_reward = '';
UPDATE supported_currencies SET minimum_balance = NULL WHERE minimum_balance = '';
UPDATE supported_currencies SET withdrawal_fee_percent = NULL WHERE withdrawal_fee_percent = '';

-- Step 2: Convert column types
ALTER TABLE wallet_transactions ALTER COLUMN amount TYPE DECIMAL(18,8) USING COALESCE(amount::numeric(18,8), 0);
ALTER TABLE wallet_transactions ALTER COLUMN balance_after TYPE DECIMAL(18,8) USING COALESCE(balance_after::numeric(18,8), 0);
ALTER TABLE user_wallets ALTER COLUMN balance TYPE DECIMAL(18,8) USING COALESCE(balance::numeric(18,8), 0);
ALTER TABLE achievement_types ALTER COLUMN token_reward TYPE DECIMAL(18,8) USING COALESCE(token_reward::numeric(18,8), 0);
ALTER TABLE supported_currencies ALTER COLUMN minimum_balance TYPE DECIMAL(18,8) USING COALESCE(minimum_balance::numeric(18,8), 0);
ALTER TABLE supported_currencies ALTER COLUMN withdrawal_fee_percent TYPE NUMERIC(5,2) USING COALESCE(withdrawal_fee_percent::numeric(5,2), 0);

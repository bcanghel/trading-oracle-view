-- Add missing columns for auto_trades table
ALTER TABLE public.auto_trades 
ADD COLUMN IF NOT EXISTS risk_pips numeric,
ADD COLUMN IF NOT EXISTS reward_pips numeric;
-- Add lot size calculation columns to auto_trades table
ALTER TABLE auto_trades ADD COLUMN IF NOT EXISTS calculated_micro_lots numeric;
ALTER TABLE auto_trades ADD COLUMN IF NOT EXISTS calculated_risk_amount numeric;
ALTER TABLE auto_trades ADD COLUMN IF NOT EXISTS calculated_pip_risk numeric;
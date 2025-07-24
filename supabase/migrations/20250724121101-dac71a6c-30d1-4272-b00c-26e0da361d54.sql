-- Add columns to track rejected trades and their reasons
ALTER TABLE auto_trades ADD COLUMN rejection_reason TEXT;
ALTER TABLE auto_trades ADD COLUMN ai_confidence NUMERIC;
ALTER TABLE auto_trades ADD COLUMN risk_reward_ratio NUMERIC;

-- Update status constraint to include REJECTED
ALTER TABLE auto_trades ALTER COLUMN status DROP DEFAULT;
ALTER TABLE auto_trades ALTER COLUMN status SET DEFAULT 'OPEN';
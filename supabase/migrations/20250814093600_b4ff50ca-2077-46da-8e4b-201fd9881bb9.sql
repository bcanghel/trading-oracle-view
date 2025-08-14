-- Fix EUR/USD trade that should be monitoring for SL/TP
-- Mark market order as filled since market orders execute immediately
UPDATE auto_trades 
SET 
  entry_filled = true,
  entry_filled_at = created_at
WHERE 
  id = 'e0dc2951-2e0f-4b74-b0d4-7ca6958a9335' 
  AND order_type = 'MARKET' 
  AND entry_filled = false;
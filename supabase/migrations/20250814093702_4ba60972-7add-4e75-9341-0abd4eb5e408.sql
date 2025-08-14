-- Manually close EUR/USD trade that hit take profit
-- SELL trade: Entry 1.17132, Take Profit 1.16756
-- Pips calculation: (1.17132 - 1.16756) * 10000 = 37.6 pips WIN
UPDATE auto_trades 
SET 
  status = 'WIN',
  pips_result = 38,
  closed_at = NOW()
WHERE 
  id = 'e0dc2951-2e0f-4b74-b0d4-7ca6958a9335' 
  AND status = 'OPEN';
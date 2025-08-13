-- Create a public view for auto trades statistics
CREATE OR REPLACE VIEW public.public_auto_trades_stats AS
SELECT 
  symbol,
  action,
  entry_price,
  stop_loss,
  take_profit,
  status,
  pips_result,
  lot_size,
  calculated_micro_lots,
  calculated_risk_amount,
  calculated_pip_risk,
  ai_confidence,
  risk_reward_ratio,
  session_name,
  created_at,
  closed_at
FROM public.auto_trades
WHERE user_id IS NOT NULL
ORDER BY created_at DESC;

-- Allow public access to the view
ALTER VIEW public.public_auto_trades_stats OWNER TO postgres;
GRANT SELECT ON public.public_auto_trades_stats TO anon;
GRANT SELECT ON public.public_auto_trades_stats TO authenticated;
-- Add enhanced analysis columns to auto_trades table for storing new features
ALTER TABLE public.auto_trades 
ADD COLUMN IF NOT EXISTS enhanced_features JSONB,
ADD COLUMN IF NOT EXISTS confluence_score INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS session_context JSONB,
ADD COLUMN IF NOT EXISTS deterministic_used BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS adr_used_today NUMERIC,
ADD COLUMN IF NOT EXISTS distance_to_vwap_bps NUMERIC,
ADD COLUMN IF NOT EXISTS algorithmic_strategy TEXT;

-- Add index for enhanced features querying
CREATE INDEX IF NOT EXISTS idx_auto_trades_confluence_score ON public.auto_trades(confluence_score);
CREATE INDEX IF NOT EXISTS idx_auto_trades_algorithmic_strategy ON public.auto_trades(algorithmic_strategy);

-- Comment for documentation
COMMENT ON COLUMN public.auto_trades.enhanced_features IS 'JSON object containing all enhanced analysis features (ADR, VWAP, zones, etc.)';
COMMENT ON COLUMN public.auto_trades.confluence_score IS 'Confluence score 0-100 from enhanced analysis engine';
COMMENT ON COLUMN public.auto_trades.session_context IS 'Session information (minutesToEOD, session name, timezone info)';
COMMENT ON COLUMN public.auto_trades.deterministic_used IS 'Whether deterministic engine was used instead of AI';
COMMENT ON COLUMN public.auto_trades.algorithmic_strategy IS 'Strategy used: BREAKOUT, TREND, or MEANREV';
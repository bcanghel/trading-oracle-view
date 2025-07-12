-- Add strategy column to trade_analyses table
ALTER TABLE public.trade_analyses 
ADD COLUMN strategy_type TEXT NOT NULL DEFAULT '1H' 
CHECK (strategy_type IN ('1H', '1H+4H'));
-- Add order type and entry filled status to auto_trades table
ALTER TABLE auto_trades 
ADD COLUMN order_type TEXT DEFAULT 'MARKET' CHECK (order_type IN ('MARKET', 'LIMIT')),
ADD COLUMN entry_filled BOOLEAN DEFAULT false,
ADD COLUMN entry_filled_at TIMESTAMP WITH TIME ZONE;

-- Update existing trades to have entry_filled = true since they were all market orders
UPDATE auto_trades SET entry_filled = true, order_type = 'MARKET' WHERE entry_filled IS NULL;

-- Add comment to explain the new columns
COMMENT ON COLUMN auto_trades.order_type IS 'MARKET: immediate execution, LIMIT: wait for entry price to be reached';
COMMENT ON COLUMN auto_trades.entry_filled IS 'Whether the entry price has been reached and trade is active';
COMMENT ON COLUMN auto_trades.entry_filled_at IS 'When the entry price was reached for limit orders';
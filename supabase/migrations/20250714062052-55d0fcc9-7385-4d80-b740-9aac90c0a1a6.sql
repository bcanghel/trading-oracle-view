-- Create auto-trades table for tracking generated trades
CREATE TABLE public.auto_trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  symbol TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL')),
  entry_price DECIMAL(10,5) NOT NULL,
  stop_loss DECIMAL(10,5) NOT NULL,
  take_profit DECIMAL(10,5) NOT NULL,
  session_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'WIN', 'LOSS')),
  pips_result DECIMAL(8,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  next_check_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.auto_trades ENABLE ROW LEVEL SECURITY;

-- Create policies for auto_trades
CREATE POLICY "Users can view their own auto trades" 
ON public.auto_trades 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own auto trades" 
ON public.auto_trades 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own auto trades" 
ON public.auto_trades 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own auto trades" 
ON public.auto_trades 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_auto_trades_updated_at
BEFORE UPDATE ON public.auto_trades
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
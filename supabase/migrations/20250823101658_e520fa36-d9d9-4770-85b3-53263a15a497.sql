-- Create table for USD fundamental economic data
CREATE TABLE public.usd_fundamentals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('CPI', 'Core CPI', 'PCE', 'NFP', 'Unemployment', 'Jobless Claims', 'GDP', 'PMI Manufacturing', 'PMI Services', 'Retail Sales', 'Rate Decision')),
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_value NUMERIC NOT NULL,
  forecast_value NUMERIC,
  previous_value NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.usd_fundamentals ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own USD fundamentals" 
ON public.usd_fundamentals 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own USD fundamentals" 
ON public.usd_fundamentals 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own USD fundamentals" 
ON public.usd_fundamentals 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own USD fundamentals" 
ON public.usd_fundamentals 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_usd_fundamentals_updated_at
BEFORE UPDATE ON public.usd_fundamentals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for efficient queries
CREATE INDEX idx_usd_fundamentals_user_date ON public.usd_fundamentals(user_id, event_date DESC);
CREATE INDEX idx_usd_fundamentals_event_type ON public.usd_fundamentals(event_type, event_date DESC);
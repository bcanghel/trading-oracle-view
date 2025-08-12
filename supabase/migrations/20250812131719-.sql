-- Create table for Telegram subscribers
CREATE TABLE public.telegram_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id BIGINT NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  subscribed_pairs TEXT[] DEFAULT ARRAY[]::TEXT[], -- Empty array means all pairs
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.telegram_subscribers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own telegram subscriptions" 
ON public.telegram_subscribers 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own telegram subscriptions" 
ON public.telegram_subscribers 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own telegram subscriptions" 
ON public.telegram_subscribers 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own telegram subscriptions" 
ON public.telegram_subscribers 
FOR DELETE 
USING (auth.uid() = user_id);

-- Service role can manage all subscriptions (for bot operations)
CREATE POLICY "Service role can manage telegram subscriptions" 
ON public.telegram_subscribers 
FOR ALL 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_telegram_subscribers_updated_at
BEFORE UPDATE ON public.telegram_subscribers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for telegram notifications log
CREATE TABLE public.telegram_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  trade_id UUID REFERENCES public.auto_trades(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  notification_type TEXT NOT NULL, -- 'TRADE_OPEN', 'TRADE_CLOSE', 'TRADE_UPDATE'
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  telegram_message_id INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT
);

-- Enable RLS for notifications log
ALTER TABLE public.telegram_notifications ENABLE ROW LEVEL SECURITY;

-- Service role can manage all notifications
CREATE POLICY "Service role can manage telegram notifications" 
ON public.telegram_notifications 
FOR ALL 
USING (true);
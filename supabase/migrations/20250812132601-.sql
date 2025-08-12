-- Fix security issue: Restrict access to telegram_notifications table
-- Drop the overly permissive policy and create proper ones

DROP POLICY IF EXISTS "Service role can manage telegram notifications" ON public.telegram_notifications;

-- Allow service role to manage all notifications (needed for bot operations)
CREATE POLICY "Service role can manage all telegram notifications" 
ON public.telegram_notifications 
FOR ALL 
TO service_role
USING (true);

-- Allow users to view only notifications for their own trades
CREATE POLICY "Users can view their own trade notifications" 
ON public.telegram_notifications 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.auto_trades 
    WHERE auto_trades.id = telegram_notifications.trade_id 
    AND auto_trades.user_id = auth.uid()
  )
);

-- Prevent any other access - no insert/update/delete for regular users
-- Only service role should create notifications via the bot

-- Also add a policy to prevent anonymous access completely
CREATE POLICY "Block anonymous access to telegram notifications" 
ON public.telegram_notifications 
FOR ALL 
TO anon
USING (false);
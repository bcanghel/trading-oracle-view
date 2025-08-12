-- Fix critical security issue: Restrict access to telegram_subscribers table
-- The current "Service role can manage telegram subscriptions" policy is too permissive

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can manage telegram subscriptions" ON public.telegram_subscribers;

-- Create a proper service-role-only policy for bot operations
CREATE POLICY "Service role only can manage telegram subscriptions" 
ON public.telegram_subscribers 
FOR ALL 
TO service_role
USING (true);

-- Block anonymous access completely
CREATE POLICY "Block anonymous access to telegram subscriptions" 
ON public.telegram_subscribers 
FOR ALL 
TO anon
USING (false);

-- The existing user policies remain unchanged:
-- - Users can create their own telegram subscriptions
-- - Users can delete their own telegram subscriptions  
-- - Users can update their own telegram subscriptions
-- - Users can view their own telegram subscriptions
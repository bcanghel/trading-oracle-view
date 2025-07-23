-- Create a policy that allows the service role to insert auto trades
CREATE POLICY "Service role can create auto trades" 
ON public.auto_trades 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- Create a policy that allows the service role to update auto trades  
CREATE POLICY "Service role can update auto trades"
ON public.auto_trades
FOR UPDATE 
TO service_role
USING (true);

-- Create a policy that allows the service role to select auto trades
CREATE POLICY "Service role can select auto trades"
ON public.auto_trades
FOR SELECT
TO service_role
USING (true);
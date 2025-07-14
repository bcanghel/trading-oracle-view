-- Drop the existing cron job and recreate it with proper JSON formatting
SELECT cron.unschedule('auto-trading-scheduler');

-- Create a cron job to run the auto-trading scheduler every 15 minutes with proper JSON body
SELECT cron.schedule(
  'auto-trading-scheduler',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT
    net.http_post(
        url:='https://cgmzxonyaiwtcyxmmhsi.supabase.co/functions/v1/auto-trading-scheduler',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnbXp4b255YWl3dGN5eG1taHNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5NzA2MzYsImV4cCI6MjA2NzU0NjYzNn0.jv5vMtuiLSmJijipBAVlTwjzXp123IDBA9kslT9kQEM"}'::jsonb,
        body:='{"time": "scheduled"}'::jsonb
    ) as request_id;
  $$
);
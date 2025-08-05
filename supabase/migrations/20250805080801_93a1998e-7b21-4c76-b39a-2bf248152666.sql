-- Update existing trades to assign them to your user ID
UPDATE auto_trades 
SET user_id = 'b195e363-8000-4440-9632-f9af83eb0e8c' 
WHERE user_id IS NULL;
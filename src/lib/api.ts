export const fetchMarketData = async (symbol: string, strategy: string = '1H') => {
  const response = await fetch('https://cgmzxonyaiwtcyxmmhsi.supabase.co/functions/v1/fetch-market-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnbXp4b255YWl3dGN5eG1taHNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5NzA2MzYsImV4cCI6MjA2NzU0NjYzNn0.jv5vMtuiLSmJijipBAVlTwjzXp123IDBA9kslT9kQEM`
    },
    body: JSON.stringify({ symbol, strategy })
  });

  if (!response.ok) {
    throw new Error('Failed to fetch market data');
  }

  return response.json();
};

export const analyzeTradingOpportunity = async (symbol: string, historicalData: any[], currentData: any, historical4hData: any[] | null = null, strategy: string = '1H') => {
  const response = await fetch('https://cgmzxonyaiwtcyxmmhsi.supabase.co/functions/v1/analyze-trading-opportunity', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnbXp4b255YWl3dGN5eG1taHNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5NzA2MzYsImV4cCI6MjA2NzU0NjYzNn0.jv5vMtuiLSmJijipBAVlTwjzXp123IDBA9kslT9kQEM`
    },
    body: JSON.stringify({ symbol, historicalData, currentData, historical4hData, strategy })
  });

  if (!response.ok) {
    throw new Error('Failed to analyze trading opportunity');
  }

  return response.json();
};
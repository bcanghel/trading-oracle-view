export const fetchMarketData = async (symbol: string, strategy: string = '1H', useDeterministic: boolean = false) => {
  const response = await fetch('https://cgmzxonyaiwtcyxmmhsi.supabase.co/functions/v1/fetch-market-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnbXp4b255YWl3dGN5eG1taHNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5NzA2MzYsImV4cCI6MjA2NzU0NjYzNn0.jv5vMtuiLSmJijipBAVlTwjzXp123IDBA9kslT9kQEM`
    },
    body: JSON.stringify({ symbol, strategy, useDeterministic })
  });

  if (!response.ok) {
    throw new Error('Failed to fetch market data');
  }

  return response.json();
};

export const fetchUSDFundamentals = async () => {
  const { supabase } = await import('@/integrations/supabase/client');
  
  // Fetch fundamentals from last 14 days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 14);
  
  const { data, error } = await supabase
    .from('usd_fundamentals')
    .select('*')
    .gte('event_date', cutoffDate.toISOString())
    .order('event_date', { ascending: false });
    
  if (error) {
    console.warn('Failed to fetch USD fundamentals:', error);
    return [];
  }
  
  return data || [];
};

export const analyzeTradingOpportunity = async (
  symbol: string, 
  historicalData: any[], 
  currentData: any, 
  historical4hData: any[] | null = null, 
  strategy: string = '1H',
  options: { useDeterministic?: boolean; historical1dData?: any[] | null; aiProvider?: 'claude' | 'openai' } = {}
) => {
  const { useDeterministic = false, historical1dData = null, aiProvider = 'claude' } = options;
  
  // Fetch USD fundamentals for USD pairs
  let fundamentals = null;
  if (symbol.includes('USD')) {
    try {
      const usdData = await fetchUSDFundamentals();
      if (usdData.length > 0) {
        const [baseCcy, quoteCcy] = symbol.split('/');
        fundamentals = {
          baseCcy,
          quoteCcy,
          releases: usdData.map(f => ({
            currency: 'USD',
            event: f.event_type,
            time: f.event_date,
            actual: f.actual_value,
            forecast: f.forecast_value,
            previous: f.previous_value
          }))
        };
      }
    } catch (error) {
      console.warn('Failed to prepare fundamentals for analysis:', error);
    }
  }
  
  const response = await fetch('https://cgmzxonyaiwtcyxmmhsi.supabase.co/functions/v1/analyze-trading-opportunity', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnbXp4b255YWl3dGN5eG1taHNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5NzA2MzYsImV4cCI6MjA2NzU0NjYzNn0.jv5vMtuiLSmJijipBAVlTwjzXp123IDBA9kslT9kQEM`
    },
    body: JSON.stringify({ symbol, historicalData, currentData, historical4hData, historical1dData, strategy, useDeterministic, fundamentals, aiProvider })
  });

  if (!response.ok) {
    throw new Error('Failed to analyze trading opportunity');
  }

  return response.json();
};

export const testAutoTradingScheduler = async () => {
  const response = await fetch('https://cgmzxonyaiwtcyxmmhsi.supabase.co/functions/v1/auto-trading-scheduler', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnbXp4b255YWl3dGN5eG1taHNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5NzA2MzYsImV4cCI6MjA2NzU0NjYzNn0.jv5vMtuiLSmJijipBAVlTwjzXp123IDBA9kslT9kQEM`
    },
    body: JSON.stringify({ time: "manual_test" })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Auto trading scheduler failed: ${error}`);
  }

  return response.json();
};
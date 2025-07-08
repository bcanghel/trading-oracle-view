import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();
    const twelveApiKey = Deno.env.get('TWELVE_API');

    console.log(`Starting analysis for symbol: ${symbol}`);
    console.log(`API Key exists: ${!!twelveApiKey}`);

    if (!twelveApiKey) {
      throw new Error('Twelve API key not configured');
    }

    // For Twelve API, forex symbols should keep the slash format
    const apiSymbol = symbol; // Keep original format like "EUR/USD"
    
    console.log(`Using symbol: ${symbol} for Twelve API`);
    
    // Try different symbol formats if the first one fails
    const symbolVariants = [
      symbol,                    // "EUR/USD"
      symbol.replace('/', ''),   // "EURUSD"  
      `FX:${symbol}`,           // "FX:EUR/USD"
      `CURRENCY:${symbol}`      // "CURRENCY:EUR/USD"
    ];
    
    // Try different symbol formats until one works
    let quoteData = null;
    let historicalData = null;
    let workingSymbol = null;
    
    for (const testSymbol of symbolVariants) {
      try {
        console.log(`Trying symbol format: ${testSymbol}`);
        
        // Build the quote URL
        const quoteUrl = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(testSymbol)}&apikey=${twelveApiKey}`;
        console.log(`Quote URL: ${quoteUrl.replace(twelveApiKey, 'HIDDEN_KEY')}`);
        
        // Fetch current quote
        const quoteResponse = await fetch(quoteUrl);
        
        if (quoteResponse.ok) {
          const testQuoteData = await quoteResponse.json();
          console.log(`Quote API response for ${testSymbol}:`, JSON.stringify(testQuoteData, null, 2));
          
          if (testQuoteData.status !== 'error' && testQuoteData.close) {
            // Success! Now try historical data with the same format
            const historicalUrl = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(testSymbol)}&interval=1h&outputsize=24&apikey=${twelveApiKey}`;
            console.log(`Historical URL: ${historicalUrl.replace(twelveApiKey, 'HIDDEN_KEY')}`);

            const historicalResponse = await fetch(historicalUrl);
            
            if (historicalResponse.ok) {
              const testHistoricalData = await historicalResponse.json();
              console.log(`Historical API response for ${testSymbol}:`, JSON.stringify(testHistoricalData, null, 2));
              
              if (testHistoricalData.status !== 'error' && testHistoricalData.values) {
                // Both calls successful!
                quoteData = testQuoteData;
                historicalData = testHistoricalData;
                workingSymbol = testSymbol;
                console.log(`Successfully found data for symbol format: ${testSymbol}`);
                break;
              }
            }
          }
        }
      } catch (err) {
        console.log(`Symbol format ${testSymbol} failed: ${err.message}`);
        continue;
      }
    }
    
    if (!quoteData || !historicalData) {
      throw new Error(`Unable to fetch data for ${symbol}. Tried formats: ${symbolVariants.join(', ')}`);
    }

    // Process current market data
    const currentData = {
      symbol: symbol,
      currentPrice: parseFloat(quoteData.close || quoteData.price || 0),
      change: parseFloat(quoteData.change) || 0,
      changePercent: parseFloat(quoteData.percent_change) || 0,
      volume: parseFloat(quoteData.volume) || 0,
      high24h: parseFloat(quoteData.high) || parseFloat(quoteData.close || quoteData.price || 0),
      low24h: parseFloat(quoteData.low) || parseFloat(quoteData.close || quoteData.price || 0),
    };

    // Process historical data for analysis
    const processedHistoricalData = historicalData.values?.map((candle: any) => ({
      datetime: candle.datetime,
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
      volume: parseFloat(candle.volume) || 0,
    })).reverse() || []; // Reverse to get chronological order

    console.log(`Processed ${processedHistoricalData.length} historical data points`);
    console.log(`Current data:`, JSON.stringify(currentData, null, 2));

    return new Response(
      JSON.stringify({
        currentData,
        historicalData: processedHistoricalData,
        success: true,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in fetch-market-data function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
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

    if (!twelveApiKey) {
      throw new Error('Twelve API key not configured');
    }

    // Convert forex symbol to Twelve API format (remove slash and ensure uppercase)
    const apiSymbol = symbol.replace('/', '').toUpperCase();
    
    console.log(`Fetching data for symbol: ${symbol} -> API symbol: ${apiSymbol}`);
    
    // Fetch current quote
    const quoteResponse = await fetch(
      `https://api.twelvedata.com/quote?symbol=${apiSymbol}&apikey=${twelveApiKey}`
    );
    
    if (!quoteResponse.ok) {
      throw new Error(`Failed to fetch quote: ${quoteResponse.statusText}`);
    }
    
    const quoteData = await quoteResponse.json();
    console.log(`Quote API response:`, JSON.stringify(quoteData, null, 2));
    
    if (quoteData.status === 'error') {
      throw new Error(`Quote API error: ${quoteData.message || 'Unknown error'}`);
    }

    // Fetch 24-hour historical data (hourly intervals)
    const historicalResponse = await fetch(
      `https://api.twelvedata.com/time_series?symbol=${apiSymbol}&interval=1h&outputsize=24&apikey=${twelveApiKey}`
    );
    
    if (!historicalResponse.ok) {
      throw new Error(`Failed to fetch historical data: ${historicalResponse.statusText}`);
    }
    
    const historicalData = await historicalResponse.json();
    console.log(`Historical API response:`, JSON.stringify(historicalData, null, 2));
    
    if (historicalData.status === 'error') {
      throw new Error(`Historical data API error: ${historicalData.message || 'Unknown error'}`);
    }

    // Process current market data
    const currentData = {
      symbol: symbol,
      currentPrice: parseFloat(quoteData.close),
      change: parseFloat(quoteData.change) || 0,
      changePercent: parseFloat(quoteData.percent_change) || 0,
      volume: parseFloat(quoteData.volume) || 0,
      high24h: parseFloat(quoteData.high) || parseFloat(quoteData.close),
      low24h: parseFloat(quoteData.low) || parseFloat(quoteData.close),
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
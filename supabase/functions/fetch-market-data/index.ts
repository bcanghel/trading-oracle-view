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

    // Convert forex symbol to Twelve API format (remove slash and ensure uppercase)
    const apiSymbol = symbol.replace('/', '').toUpperCase();
    
    console.log(`Converted symbol: ${symbol} -> ${apiSymbol}`);
    
    // Build the quote URL
    const quoteUrl = `https://api.twelvedata.com/quote?symbol=${apiSymbol}&apikey=${twelveApiKey}`;
    console.log(`Quote URL: ${quoteUrl.replace(twelveApiKey, 'HIDDEN_KEY')}`);
    
    // Fetch current quote
    const quoteResponse = await fetch(quoteUrl);
    
    console.log(`Quote response status: ${quoteResponse.status}`);
    console.log(`Quote response ok: ${quoteResponse.ok}`);
    
    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text();
      console.log(`Quote response error text: ${errorText}`);
      throw new Error(`Failed to fetch quote: ${quoteResponse.status} - ${errorText}`);
    }
    
    const quoteData = await quoteResponse.json();
    console.log(`Quote API response:`, JSON.stringify(quoteData, null, 2));
    
    if (quoteData.status === 'error') {
      throw new Error(`Quote API error: ${quoteData.message || 'Unknown error'}`);
    }

    // Build historical data URL
    const historicalUrl = `https://api.twelvedata.com/time_series?symbol=${apiSymbol}&interval=1h&outputsize=24&apikey=${twelveApiKey}`;
    console.log(`Historical URL: ${historicalUrl.replace(twelveApiKey, 'HIDDEN_KEY')}`);

    // Fetch 24-hour historical data (hourly intervals)
    const historicalResponse = await fetch(historicalUrl);
    
    console.log(`Historical response status: ${historicalResponse.status}`);
    console.log(`Historical response ok: ${historicalResponse.ok}`);
    
    if (!historicalResponse.ok) {
      const errorText = await historicalResponse.text();
      console.log(`Historical response error text: ${errorText}`);
      throw new Error(`Failed to fetch historical data: ${historicalResponse.status} - ${errorText}`);
    }
    
    const historicalData = await historicalResponse.json();
    console.log(`Historical API response:`, JSON.stringify(historicalData, null, 2));
    
    if (historicalData.status === 'error') {
      throw new Error(`Historical data API error: ${historicalData.message || 'Unknown error'}`);
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
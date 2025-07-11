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
    console.log(`Current time: ${new Date().toISOString()}`);

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
            const historicalUrl = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(testSymbol)}&interval=1h&outputsize=48&apikey=${twelveApiKey}`;
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

    // Calculate tick volume and alternative volume metrics
    const calculateForexVolume = (candles: any[]) => {
      return candles.map((candle: any, index: number) => {
        const currentPrice = parseFloat(candle.close);
        const openPrice = parseFloat(candle.open);
        const highPrice = parseFloat(candle.high);
        const lowPrice = parseFloat(candle.low);
        
        // 1. Tick Volume - based on price movement intensity
        const priceChange = Math.abs(currentPrice - openPrice);
        const priceRange = highPrice - lowPrice;
        const tickVolume = Math.round((priceChange + priceRange) * 100000); // Scale for forex
        
        // 2. Alternative Volume Metrics
        
        // ATR-based volume (volatility as volume proxy)
        const atrVolume = Math.round(priceRange * 1000000); // Scale ATR to volume-like number
        
        // Session-based activity multiplier
        const candleTime = new Date(candle.datetime);
        const hour = candleTime.getUTCHours();
        let sessionMultiplier = 1;
        
        // London session (8-17 UTC) - high activity
        if (hour >= 8 && hour <= 17) sessionMultiplier = 1.5;
        // New York session (13-22 UTC) - high activity  
        if (hour >= 13 && hour <= 22) sessionMultiplier = 1.7;
        // London-NY overlap (13-17 UTC) - highest activity
        if (hour >= 13 && hour <= 17) sessionMultiplier = 2.0;
        // Asian session (0-9 UTC) - lower activity
        if (hour >= 0 && hour <= 9) sessionMultiplier = 0.8;
        
        // Momentum-based volume (larger moves = higher volume)
        const momentumVolume = Math.round(Math.abs(currentPrice - openPrice) * 5000000);
        
        // Combined synthetic volume
        const syntheticVolume = Math.round(
          (tickVolume * 0.3) + 
          (atrVolume * 0.3) + 
          (momentumVolume * sessionMultiplier * 0.4)
        );
        
        return {
          ...candle,
          volume: syntheticVolume,
          tickVolume,
          atrVolume,
          momentumVolume,
          sessionMultiplier,
          volumeMetrics: {
            priceRange,
            priceChange,
            sessionActivity: sessionMultiplier
          }
        };
      });
    };

    // Process current market data with synthetic volume
    const currentPrice = parseFloat(quoteData.close || quoteData.price || 0);
    const currentHigh = parseFloat(quoteData.high) || currentPrice;
    const currentLow = parseFloat(quoteData.low) || currentPrice;
    const currentRange = currentHigh - currentLow;
    const currentChange = parseFloat(quoteData.change) || 0;
    
    // Calculate current synthetic volume
    const currentHour = new Date().getUTCHours();
    let currentSessionMultiplier = 1;
    if (currentHour >= 8 && currentHour <= 17) currentSessionMultiplier = 1.5;
    if (currentHour >= 13 && currentHour <= 22) currentSessionMultiplier = 1.7;
    if (currentHour >= 13 && currentHour <= 17) currentSessionMultiplier = 2.0;
    if (currentHour >= 0 && currentHour <= 9) currentSessionMultiplier = 0.8;
    
    const currentSyntheticVolume = Math.round(
      (Math.abs(currentChange) * 300000) + 
      (currentRange * 1000000) * currentSessionMultiplier
    );

    const currentData = {
      symbol: symbol,
      currentPrice,
      change: currentChange,
      changePercent: parseFloat(quoteData.percent_change) || 0,
      volume: currentSyntheticVolume,
      high24h: currentHigh,
      low24h: currentLow,
      volumeType: 'synthetic', // Indicate this is synthetic volume
      sessionMultiplier: currentSessionMultiplier
    };

    // Process historical data for analysis
    const currentTime = new Date();
    const processedHistoricalData = historicalData.values?.map((candle: any, index: number) => {
      const candleTime = new Date(candle.datetime);
      const timeDiff = candleTime.getTime() - currentTime.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      // Log suspicious timestamps
      if (hoursDiff > 1) {
        console.log(`WARNING: Future timestamp detected at index ${index}: ${candle.datetime} (${hoursDiff.toFixed(2)} hours in future)`);
      }
      
      return {
        datetime: candle.datetime,
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: 0, // Will be calculated below
      };
    }).reverse() || []; // Reverse to get chronological order

    // Calculate synthetic volume for historical data
    const historicalWithVolume = calculateForexVolume(processedHistoricalData);

    // Filter out future timestamps (more than 1 hour in future)
    const validHistoricalData = historicalWithVolume.filter((candle: any) => {
      const candleTime = new Date(candle.datetime);
      const timeDiff = candleTime.getTime() - currentTime.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      return hoursDiff <= 1; // Allow up to 1 hour in future for timezone tolerance
    });

    console.log(`Processed ${processedHistoricalData.length} historical data points`);
    console.log(`Filtered to ${validHistoricalData.length} valid data points (removing future timestamps)`);
    console.log(`First candle: ${validHistoricalData[0]?.datetime || 'None'}`);
    console.log(`Last candle: ${validHistoricalData[validHistoricalData.length - 1]?.datetime || 'None'}`);
    console.log(`Current data:`, JSON.stringify(currentData, null, 2));
    console.log(`Sample volume metrics:`, validHistoricalData.slice(-3).map(c => ({
      time: c.datetime,
      volume: c.volume,
      tickVolume: c.tickVolume,
      sessionMultiplier: c.sessionMultiplier
    })));

    return new Response(
      JSON.stringify({
        currentData,
        historicalData: validHistoricalData,
        success: true,
        metadata: {
          totalCandles: processedHistoricalData.length,
          validCandles: validHistoricalData.length,
          filteredCandles: processedHistoricalData.length - validHistoricalData.length
        }
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
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
    const { symbol, strategy = '1H', useDeterministic = false } = await req.json();
    const twelveApiKey = Deno.env.get('TWELVE_API');

    console.log(`Starting enhanced analysis for symbol: ${symbol}, strategy: ${strategy}, deterministic: ${useDeterministic}`);
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
    
    // Enhanced data fetching with proper window sizes and warm-up buffers
    let quoteData = null;
    let historicalData = null;
    let historical4hData = null;
    let historical1dData = null;
    let workingSymbol = null;
    
    // Determine fetch sizes based on new constraints with warm-up buffers
    const FETCH_SIZES = {
      '1H': 188,  // 168 + 20 warm-up
      '4H': 90,   // 84 + 6 warm-up  
      '1D': 27    // 22 + 5 warm-up
    };
    
    const USE_SIZES = {
      '1H': 168,  // 1 week
      '4H': 84,   // 2 weeks
      '1D': 22    // 1 month
    };
    
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
            // Fetch 1H data with enhanced window
            const historical1hUrl = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(testSymbol)}&interval=1h&outputsize=${FETCH_SIZES['1H']}&apikey=${twelveApiKey}`;
            console.log(`1H Historical URL: ${historical1hUrl.replace(twelveApiKey, 'HIDDEN_KEY')}`);

            const historical1hResponse = await fetch(historical1hUrl);
            
            if (historical1hResponse.ok) {
              const test1hData = await historical1hResponse.json();
              console.log(`1H Historical API response for ${testSymbol}: ${test1hData.values?.length || 0} candles`);
              
              if (test1hData.status !== 'error' && test1hData.values) {
                let test4hData = null;
                let test1dData = null;
                
                // Always fetch 4H and 1D data for enhanced analysis
                const historical4hUrl = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(testSymbol)}&interval=4h&outputsize=${FETCH_SIZES['4H']}&apikey=${twelveApiKey}`;
                console.log(`4H Historical URL: ${historical4hUrl.replace(twelveApiKey, 'HIDDEN_KEY')}`);
                
                const historical4hResponse = await fetch(historical4hUrl);
                if (historical4hResponse.ok) {
                  const temp4hData = await historical4hResponse.json();
                  if (temp4hData.status !== 'error' && temp4hData.values) {
                    test4hData = temp4hData;
                    console.log(`Successfully fetched 4H data for ${testSymbol}: ${temp4hData.values.length} candles`);
                  }
                }
                
                // Fetch 1D data for daily context
                const historical1dUrl = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(testSymbol)}&interval=1day&outputsize=${FETCH_SIZES['1D']}&apikey=${twelveApiKey}`;
                console.log(`1D Historical URL: ${historical1dUrl.replace(twelveApiKey, 'HIDDEN_KEY')}`);
                
                const historical1dResponse = await fetch(historical1dUrl);
                if (historical1dResponse.ok) {
                  const temp1dData = await historical1dResponse.json();
                  if (temp1dData.status !== 'error' && temp1dData.values) {
                    test1dData = temp1dData;
                    console.log(`Successfully fetched 1D data for ${testSymbol}: ${temp1dData.values.length} candles`);
                  }
                }
                
                // All calls successful!
                quoteData = testQuoteData;
                historicalData = test1hData;
                historical4hData = test4hData;
                historical1dData = test1dData;
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
    
    // Enhanced session and timezone calculations
    const calculateSessionContext = () => {
      const currentTime = new Date();
      const romaniaTime = new Date(currentTime.toLocaleString('en-US', { timeZone: 'Europe/Bucharest' }));
      const nyTime = new Date(currentTime.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const utcTime = new Date(currentTime.toLocaleString('en-US', { timeZone: 'UTC' }));
      
      // Calculate EOD as 17:00 America/New_York
      const nyEodHour = 17;
      const currentNyHour = nyTime.getHours();
      const currentNyMinute = nyTime.getMinutes();
      const minutesUntilEod = currentNyHour < nyEodHour 
        ? (nyEodHour - currentNyHour) * 60 - currentNyMinute
        : (24 - currentNyHour + nyEodHour) * 60 - currentNyMinute;
      
      // Determine current session
      const utcHour = utcTime.getHours();
      let currentSession = 'Closed';
      if (utcHour >= 0 && utcHour < 9) currentSession = 'Tokyo';
      else if (utcHour >= 8 && utcHour < 17) currentSession = 'London';  
      else if (utcHour >= 13 && utcHour < 22) currentSession = 'NewYork';
      if (utcHour >= 13 && utcHour < 17) currentSession = 'Overlap'; // London-NY overlap
      
      // Weekend check
      const romaniaDay = romaniaTime.getDay();
      const romaniaHour = romaniaTime.getHours();
      const isWeekendOrHoliday = 
        romaniaDay === 0 || // Sunday
        romaniaDay === 6 || // Saturday  
        (romaniaDay === 5 && romaniaHour >= 19) || // Friday after 19:00
        (romaniaDay === 1 && romaniaHour < 10); // Monday before 10:00
      
      return {
        minutesToEOD: Math.max(0, minutesUntilEod),
        session: currentSession,
        isWeekendOrHoliday,
        romaniaTime: romaniaTime.toISOString(),
        nyTime: nyTime.toISOString(),
        utcTime: utcTime.toISOString()
      };
    };

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

    // Enhanced processing with proper filtering and truncation
    const sessionContext = calculateSessionContext();
    const currentTime = new Date();
    
    // Process 1H data with enhanced filtering
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
    
    // Drop current in-progress bar if needed
    const filteredHistoricalData = processedHistoricalData.filter((candle: any) => {
      const candleTime = new Date(candle.datetime);
      const timeDiff = candleTime.getTime() - currentTime.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      return hoursDiff <= 1; // Allow up to 1 hour in future for timezone tolerance
    });
    
    // Truncate to use sizes (keeping most recent data)
    const truncatedHistoricalData = filteredHistoricalData.slice(-USE_SIZES['1H']);

    // Calculate synthetic volume for truncated historical data
    const historicalWithVolume = calculateForexVolume(truncatedHistoricalData);
    
    // Process 4H data if available
    let historical4hProcessed = null;
    if (historical4hData?.values) {
      const processed4hData = historical4hData.values.map((candle: any) => ({
        datetime: candle.datetime,
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: 0, // Will be calculated below
      })).reverse();
      
      // Truncate 4H data to use size
      const truncated4hData = processed4hData.slice(-USE_SIZES['4H']);
      historical4hProcessed = calculateForexVolume(truncated4hData);
      console.log(`Processed ${historical4hProcessed.length} 4H candles (truncated from ${processed4hData.length})`);
    }
    
    // Process 1D data if available  
    let historical1dProcessed = null;
    if (historical1dData?.values) {
      const processed1dData = historical1dData.values.map((candle: any) => ({
        datetime: candle.datetime,
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: 0, // Will be calculated below
      })).reverse();
      
      // Truncate 1D data to use size
      const truncated1dData = processed1dData.slice(-USE_SIZES['1D']);
      historical1dProcessed = calculateForexVolume(truncated1dData);
      console.log(`Processed ${historical1dProcessed.length} 1D candles (truncated from ${processed1dData.length})`);
    }

    console.log(`Enhanced processing complete:`);
    console.log(`- 1H: ${historicalWithVolume.length} candles (from ${processedHistoricalData.length} fetched)`);
    console.log(`- 4H: ${historical4hProcessed?.length || 0} candles`);
    console.log(`- 1D: ${historical1dProcessed?.length || 0} candles`);
    console.log(`- Session: ${sessionContext.session}, EOD in ${sessionContext.minutesToEOD} minutes`);
    console.log(`- Weekend/Holiday: ${sessionContext.isWeekendOrHoliday}`);
    console.log(`First 1H candle: ${historicalWithVolume[0]?.datetime || 'None'}`);
    console.log(`Last 1H candle: ${historicalWithVolume[historicalWithVolume.length - 1]?.datetime || 'None'}`);
    console.log(`Current data:`, JSON.stringify(currentData, null, 2));
    console.log(`Sample volume metrics:`, historicalWithVolume.slice(-3).map(c => ({
      time: c.datetime,
      volume: c.volume,
      tickVolume: c.tickVolume,
      sessionMultiplier: c.sessionMultiplier
    })));

    return new Response(
      JSON.stringify({
        currentData,
        historicalData: historicalWithVolume,
        historical4hData: historical4hProcessed,
        historical1dData: historical1dProcessed,
        sessionContext,
        strategy,
        success: true,
        metadata: {
          fetchSizes: FETCH_SIZES,
          useSizes: USE_SIZES,
          totalFetched1H: processedHistoricalData.length,
          usedCandles1H: historicalWithVolume.length,
          usedCandles4H: historical4hProcessed?.length || 0,
          usedCandles1D: historical1dProcessed?.length || 0,
          filteredCandles: processedHistoricalData.length - filteredHistoricalData.length,
          sessionInfo: sessionContext
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
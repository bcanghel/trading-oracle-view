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
    const { symbol, historicalData, currentData } = await req.json();
    const openAIApiKey = Deno.env.get('OPEN_AI_API');

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Calculate technical indicators and trend analysis
    const technicalAnalysis = calculateTechnicalIndicators(historicalData);
    const trendAnalysis = analyzeTrend(historicalData);
    
    // Create analysis prompt for OpenAI
    const analysisPrompt = `
You are a professional forex trading analyst. Analyze the following market data for ${symbol} and provide a trading recommendation.

Current Market Data:
- Current Price: ${currentData.currentPrice}
- 24h Change: ${currentData.changePercent}%
- 24h High: ${currentData.high24h}
- 24h Low: ${currentData.low24h}

Technical Analysis:
- Current SMA(10): ${technicalAnalysis.sma10}
- Current SMA(20): ${technicalAnalysis.sma20}
- RSI: ${technicalAnalysis.rsi}
- Support Level: ${technicalAnalysis.support}
- Resistance Level: ${technicalAnalysis.resistance}
- Recent Price Range: ${technicalAnalysis.priceRange}

Trend Analysis (24h):
- Overall Trend: ${trendAnalysis.overallTrend}
- Trend Strength: ${trendAnalysis.trendStrength}
- Price Momentum: ${trendAnalysis.momentum}
- Higher Highs/Lows: ${trendAnalysis.higherHighs ? 'Yes' : 'No'} / ${trendAnalysis.higherLows ? 'Yes' : 'No'}
- Recent Candle Patterns: ${trendAnalysis.candlePatterns}
- Volume Trend: ${trendAnalysis.volumeTrend}

Historical Data (last 24 hours):
${historicalData.slice(-12).map((candle: any, index: number) => 
  `${index + 1}. ${candle.datetime}: O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close}`
).join('\n')}

Based on this analysis, provide a JSON response with the following structure:
{
  "action": "BUY" | "SELL",
  "confidence": number (0-100),
  "entry": number,
  "stopLoss": number,
  "takeProfit": number,
  "support": number,
  "resistance": number,
  "reasoning": "detailed explanation of the analysis",
  "riskReward": number
}

IMPORTANT INSTRUCTIONS FOR ENTRY LEVEL:
- The "entry" should NOT be the current price
- Predict a future retracement/pullback level where price is likely to retrace to before continuing the trend
- For BUY signals: entry should be a level BELOW current price (a pullback to support, fibonacci retracement, or moving average)
- For SELL signals: entry should be a level ABOVE current price (a retracement to resistance, fibonacci level, or moving average)
- Base the entry on technical levels like:
  * Fibonacci retracements (38.2%, 50%, 61.8% of recent moves)
  * Support/resistance retests
  * Moving average bounces
  * Previous swing highs/lows

Consider:
1. Price action patterns and trends
2. Support and resistance levels for future entry opportunities
3. RSI for overbought/oversold conditions
4. Moving average crossovers and bounces
5. Volume analysis
6. Risk management principles
7. Fibonacci retracement levels for optimal entries

Provide a concise but thorough reasoning for your recommendation and explain why you chose that specific entry level.
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert forex trading analyst. Always respond with valid JSON format containing trading recommendations.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const aiResponse = await response.json();
    const analysisText = aiResponse.choices[0].message.content;
    
    let recommendation;
    try {
      recommendation = JSON.parse(analysisText);
    } catch (parseError) {
      console.log('JSON parsing failed, using fallback logic');
      // Fallback if JSON parsing fails - calculate proper entry levels
      const isBuySignal = technicalAnalysis.rsi < 30 || currentData.currentPrice < technicalAnalysis.sma20;
      const isSellSignal = technicalAnalysis.rsi > 70 || currentData.currentPrice > technicalAnalysis.sma20;
      
      let entryLevel;
      let stopLoss;
      let takeProfit;
      
      if (isBuySignal) {
        // For BUY: entry at support retest
        entryLevel = technicalAnalysis.support * 1.001; // Slightly above support
        const riskDistance = entryLevel * 0.002; // 20 pips risk (0.2%)
        stopLoss = entryLevel - riskDistance; // Below entry
        takeProfit = entryLevel + (riskDistance * 2); // 2:1 reward
      } else if (isSellSignal) {
        // For SELL: entry at resistance retest
        entryLevel = technicalAnalysis.resistance * 0.999; // Slightly below resistance
        const riskDistance = entryLevel * 0.002; // 20 pips risk (0.2%)
        stopLoss = entryLevel + riskDistance; // Above entry
        takeProfit = entryLevel - (riskDistance * 2); // 2:1 reward
      } else {
        // Neutral: use current price with proper RR
        entryLevel = currentData.currentPrice;
        const riskDistance = entryLevel * 0.002;
        stopLoss = entryLevel + (Math.random() > 0.5 ? riskDistance : -riskDistance);
        takeProfit = entryLevel + (stopLoss > entryLevel ? -riskDistance * 2 : riskDistance * 2);
      }
      
      recommendation = {
        action: isBuySignal ? "BUY" : isSellSignal ? "SELL" : "HOLD",
        confidence: 60,
        entry: parseFloat(entryLevel.toFixed(5)),
        stopLoss: parseFloat(stopLoss.toFixed(5)),
        takeProfit: parseFloat(takeProfit.toFixed(5)),
        support: technicalAnalysis.support,
        resistance: technicalAnalysis.resistance,
        reasoning: "Analysis based on technical indicators. Entry level calculated for optimal retracement entry.",
        riskReward: 2.0
      };
    }

    return new Response(
      JSON.stringify({
        recommendation,
        technicalAnalysis,
        success: true,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in analyze-trading-opportunity function:', error);
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

function calculateTechnicalIndicators(data: any[]) {
  if (!data || data.length < 20) {
    return {
      sma10: 0,
      sma20: 0,
      rsi: 50,
      support: 0,
      resistance: 0,
      priceRange: { high: 0, low: 0 }
    };
  }

  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);

  // Simple Moving Averages
  const sma10 = closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;

  // RSI calculation (14 periods)
  const rsi = calculateRSI(closes.slice(-15), 14);

  // Support and Resistance (recent lows and highs)
  const recentLows = lows.slice(-20);
  const recentHighs = highs.slice(-20);
  const support = Math.min(...recentLows);
  const resistance = Math.max(...recentHighs);

  return {
    sma10: parseFloat(sma10.toFixed(5)),
    sma20: parseFloat(sma20.toFixed(5)),
    rsi: parseFloat(rsi.toFixed(2)),
    support: parseFloat(support.toFixed(5)),
    resistance: parseFloat(resistance.toFixed(5)),
    priceRange: {
      high: Math.max(...highs.slice(-24)),
      low: Math.min(...lows.slice(-24))
    }
  };
}

function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i < period + 1; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return rsi;
}

function analyzeTrend(data: any[]) {
  if (!data || data.length < 12) {
    return {
      overallTrend: 'NEUTRAL',
      trendStrength: 'WEAK',
      momentum: 'NEUTRAL',
      higherHighs: false,
      higherLows: false,
      candlePatterns: 'None detected',
      volumeTrend: 'NEUTRAL'
    };
  }

  const recentCandles = data.slice(-24); // Last 24 hours
  const closes = recentCandles.map(d => d.close);
  const highs = recentCandles.map(d => d.high);
  const lows = recentCandles.map(d => d.low);
  const volumes = recentCandles.map(d => d.volume || 0);

  // Trend direction based on price movement
  const firstClose = closes[0];
  const lastClose = closes[closes.length - 1];
  const priceChange = ((lastClose - firstClose) / firstClose) * 100;

  // Calculate momentum using recent 6 candles vs previous 6
  const recentCloses = closes.slice(-6);
  const previousCloses = closes.slice(-12, -6);
  const recentAvg = recentCloses.reduce((a, b) => a + b, 0) / recentCloses.length;
  const previousAvg = previousCloses.reduce((a, b) => a + b, 0) / previousCloses.length;
  const momentum = ((recentAvg - previousAvg) / previousAvg) * 100;

  // Check for higher highs and higher lows (bullish pattern)
  const midPoint = Math.floor(highs.length / 2);
  const firstHalfHighs = highs.slice(0, midPoint);
  const secondHalfHighs = highs.slice(midPoint);
  const firstHalfLows = lows.slice(0, midPoint);
  const secondHalfLows = lows.slice(midPoint);

  const maxFirstHigh = Math.max(...firstHalfHighs);
  const maxSecondHigh = Math.max(...secondHalfHighs);
  const minFirstLow = Math.min(...firstHalfLows);
  const minSecondLow = Math.min(...secondHalfLows);

  const higherHighs = maxSecondHigh > maxFirstHigh;
  const higherLows = minSecondLow > minFirstLow;

  // Simple candle pattern detection
  const lastThreeCandles = recentCandles.slice(-3);
  let candlePatterns = 'None detected';
  
  if (lastThreeCandles.length >= 3) {
    const bullishCandles = lastThreeCandles.filter(c => c.close > c.open).length;
    const bearishCandles = lastThreeCandles.filter(c => c.close < c.open).length;
    
    if (bullishCandles === 3) {
      candlePatterns = 'Three White Soldiers (Bullish)';
    } else if (bearishCandles === 3) {
      candlePatterns = 'Three Black Crows (Bearish)';
    } else if (bullishCandles >= 2) {
      candlePatterns = 'Bullish momentum';
    } else if (bearishCandles >= 2) {
      candlePatterns = 'Bearish momentum';
    }
  }

  // Volume trend analysis
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const recentVolume = volumes.slice(-6).reduce((a, b) => a + b, 0) / 6;
  let volumeTrend = 'NEUTRAL';
  
  if (recentVolume > avgVolume * 1.2) {
    volumeTrend = 'INCREASING';
  } else if (recentVolume < avgVolume * 0.8) {
    volumeTrend = 'DECREASING';
  }

  // Overall trend determination
  let overallTrend = 'NEUTRAL';
  if (priceChange > 0.1 && momentum > 0) {
    overallTrend = 'BULLISH';
  } else if (priceChange < -0.1 && momentum < 0) {
    overallTrend = 'BEARISH';
  }

  // Trend strength
  let trendStrength = 'WEAK';
  const absChange = Math.abs(priceChange);
  if (absChange > 0.5) {
    trendStrength = 'STRONG';
  } else if (absChange > 0.2) {
    trendStrength = 'MODERATE';
  }

  return {
    overallTrend,
    trendStrength,
    momentum: momentum > 0.05 ? 'BULLISH' : momentum < -0.05 ? 'BEARISH' : 'NEUTRAL',
    higherHighs,
    higherLows,
    candlePatterns,
    volumeTrend
  };
}
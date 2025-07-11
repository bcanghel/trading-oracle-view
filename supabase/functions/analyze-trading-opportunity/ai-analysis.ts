export async function analyzeWithAI(
  symbol: string,
  historicalData: any[],
  currentData: any,
  technicalAnalysis: any,
  trendAnalysis: any,
  marketSession: any,
  romaniaTime: Date
) {
  const openAIApiKey = Deno.env.get('OPEN_AI_API');

  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Create analysis prompt for OpenAI
  const analysisPrompt = `
Analyze the forex market data for ${symbol} and provide a trading recommendation with enhanced entry conditions and market timing.

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

Market Session Analysis (Romania Time):
- Current Romania Time: ${romaniaTime.toLocaleString('en-US', { timeZone: 'Europe/Bucharest' })}
- Active Market Session: ${marketSession.name}
- Session Status: ${marketSession.status}
- Volatility Level: ${marketSession.volatility}
- Trading Recommendation: ${marketSession.recommendation}

Historical Data (last 12 candles):
${historicalData.slice(-12).map((candle: any, index: number) => 
  `${index + 1}. ${candle.datetime}: O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close}`
).join('\n')}

Provide a JSON response with this EXACT structure:
{
  "action": "BUY or SELL",
  "confidence": "integer from 10-95 based on signal strength and market conditions",
  "entry": "number - optimal entry level (NOT current price)",
  "stopLoss": "number - stop loss level",
  "takeProfit": "number - take profit level",
  "support": "number - key support level",
  "resistance": "number - key resistance level", 
  "reasoning": "detailed 2-3 sentence explanation",
  "riskReward": "number - risk to reward ratio",
  "entryConditions": "string - specific trigger conditions for entry",
  "entryTiming": "string - timing guidance and session considerations",
  "volumeConfirmation": "string - volume requirements for entry",
  "candlestickSignals": "string - candlestick confirmation patterns to watch for"
}

ENHANCED ENTRY CONDITIONS ANALYSIS:
- Specify exact trigger conditions (e.g., "Wait for price to test 1.0850 support + bullish hammer + volume spike >150% average")
- Include candlestick confirmation requirements (hammers, engulfing patterns, doji reversals)
- Define volume confirmation criteria (volume spikes, above-average volume)
- Consider moving average interactions (bounces, breaks, retests)

ENTRY TIMING & MARKET SESSION GUIDANCE:
- Consider current market session volatility and liquidity
- High volatility sessions (London-NY overlap): More aggressive entries possible
- Low volatility sessions (Asian): More conservative, wait for clear breakouts
- Account for session transitions and their impact on price action

CONFIDENCE CALCULATION GUIDELINES:
- 85-95%: Very strong signals (multiple confluences, clear trend, low risk)
- 70-84%: Strong signals (good technical setup, favorable conditions)
- 55-69%: Moderate signals (some uncertainty, mixed indicators)
- 40-54%: Weak signals (conflicting data, high uncertainty)
- 25-39%: Very weak signals (poor setup, high risk)
- 10-24%: Minimal signals (avoid trading)

ENTRY LEVEL RULES:
- For BUY: entry should be BELOW current price (pullback to support/MA)
- For SELL: entry should be ABOVE current price (retracement to resistance)
- Base on fibonacci retracements, support/resistance retests, or moving average bounces
- Do NOT use current market price as entry

Consider: RSI levels, moving average positions, support/resistance strength, trend alignment, volume confirmation, market session timing, and overall market structure.
`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        {
          role: 'system',
          content: 'You are an expert forex trading analyst. You must respond with ONLY valid JSON format containing trading recommendations. No explanatory text before or after the JSON. Start your response with { and end with }.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ],
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const aiResponse = await response.json();
  const analysisText = aiResponse.choices[0].message.content;
  
  console.log('AI Response Text:', analysisText);
  
  try {
    // Clean the response text to ensure it's valid JSON
    const cleanedText = analysisText.trim();
    const recommendation = JSON.parse(cleanedText);
    
    // Validate the recommendation has required fields
    if (!recommendation.action || !recommendation.confidence || !recommendation.entry) {
      throw new Error('Missing required fields in AI response');
    }
    
    console.log('Successfully parsed AI recommendation:', recommendation);
    return recommendation;
    
  } catch (parseError) {
    console.log('AI analysis failed:', parseError.message);
    console.log('Raw AI Response:', analysisText);
    throw new Error('AI analysis unavailable');
  }
}
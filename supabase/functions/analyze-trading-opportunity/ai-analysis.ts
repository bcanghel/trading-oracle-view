import { calculateEntrySignal } from "./entry-logic.ts";

export async function analyzeWithAI(
  symbol: string,
  historicalData: any[],
  currentData: any,
  technicalAnalysis: any,
  trendAnalysis: any,
  marketSession: any,
  romaniaTime: Date,
  strategy: string = '1H',
  historical4hData: any[] | null = null
) {
  // Calculate algorithmic suggestions as assistive information
  const algorithmicSuggestion = calculateEntrySignal({
    currentPrice: currentData.currentPrice,
    technicalAnalysis,
    trendAnalysis,
    marketSession,
    atr: technicalAnalysis.atr
  });

  const openAIApiKey = Deno.env.get('OPEN_AI_API');

  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Enhanced prompt for multi-timeframe analysis
  const multiTimeframeContext = strategy === '1H+4H' && technicalAnalysis.multiTimeframe ? `

## MULTI-TIMEFRAME ANALYSIS (1H + 4H Strategy)
- **Timeframe Confluence Score**: ${technicalAnalysis.multiTimeframe.confluence}%
- **Trend Agreement**: ${technicalAnalysis.multiTimeframe.agreement ? 'YES' : 'NO'}
- **4H Technical Data**: 
  - RSI: ${technicalAnalysis.multiTimeframe.higher4h.rsi}
  - SMA10: ${technicalAnalysis.multiTimeframe.higher4h.sma10}
  - SMA20: ${technicalAnalysis.multiTimeframe.higher4h.sma20}
  - Support: ${technicalAnalysis.multiTimeframe.higher4h.support}
  - Resistance: ${technicalAnalysis.multiTimeframe.higher4h.resistance}

**Multi-Timeframe Analysis Requirements:**
- Only consider high-confidence setups when confluence score > 70%
- Require both 1H and 4H trend alignment for trend-following trades
- Use 4H levels for major support/resistance, 1H levels for fine-tuned entries
- Increase confidence when both timeframes show same signals
- Adjust risk/reward based on higher timeframe context
` : '';

  const strategyNote = strategy === '1H+4H' ? 
    'This analysis uses ENHANCED MULTI-TIMEFRAME strategy (1H + 4H)' : 
    'This analysis uses STANDARD 1H strategy';

  // Create enhanced analysis prompt with algorithmic assistance
  const analysisPrompt = `
${strategyNote}

Analyze the forex market data for ${symbol} and provide your trading recommendation. Use the algorithmic calculations as assistive information to inform your decision.${multiTimeframeContext}

ALGORITHMIC ASSISTANCE (for reference):
- Suggested Strategy: ${algorithmicSuggestion.strategy}
- Suggested Action: ${algorithmicSuggestion.action}
- Calculated Entry: ${algorithmicSuggestion.entryPrice}
- Calculated Stop Loss: ${algorithmicSuggestion.stopLoss}
- Calculated Take Profit: ${algorithmicSuggestion.takeProfit}
- Risk/Reward Ratio: ${algorithmicSuggestion.riskRewardRatio}
- Algorithmic Confidence: ${algorithmicSuggestion.confidence}%
- Algorithmic Reasoning: ${algorithmicSuggestion.reasoning.join('. ')}

COMPREHENSIVE MARKET DATA:
- Symbol: ${symbol}
- Current Price: ${currentData.currentPrice}
- 24h Change: ${currentData.changePercent}%
- 24h High: ${currentData.high24h}
- 24h Low: ${currentData.low24h}

ENHANCED TECHNICAL ANALYSIS:
- SMA(10): ${technicalAnalysis.sma10}
- SMA(20): ${technicalAnalysis.sma20}
- RSI: ${technicalAnalysis.rsi}
- ATR: ${technicalAnalysis.atr}
- MACD: ${technicalAnalysis.macd?.macd || 0} (Signal: ${technicalAnalysis.macd?.signal || 0})
- Bollinger Bands: Upper=${technicalAnalysis.bollinger?.upper || 0}, Lower=${technicalAnalysis.bollinger?.lower || 0}
- Support Level: ${technicalAnalysis.support}
- Resistance Level: ${technicalAnalysis.resistance}
- Pivot Points: R1=${technicalAnalysis.pivotPoints?.r1 || 0}, S1=${technicalAnalysis.pivotPoints?.s1 || 0}
- Fibonacci Levels: 38.2%=${technicalAnalysis.fibonacci?.level382 || 0}, 61.8%=${technicalAnalysis.fibonacci?.level618 || 0}
- Swing Levels: High=${technicalAnalysis.swingLevels?.swingHigh || 0}, Low=${technicalAnalysis.swingLevels?.swingLow || 0}

TREND ANALYSIS:
- Overall Trend: ${trendAnalysis.overallTrend}
- Trend Strength: ${trendAnalysis.trendStrength}
- Price Momentum: ${trendAnalysis.momentum}
- Higher Highs/Lows: ${trendAnalysis.higherHighs ? 'Yes' : 'No'} / ${trendAnalysis.higherLows ? 'Yes' : 'No'}
- Candle Patterns: ${trendAnalysis.candlePatterns}
- Volume Trend: ${trendAnalysis.volumeTrend}

MARKET SESSION:
- Current Romania Time: ${romaniaTime.toLocaleString('en-US', { timeZone: 'Europe/Bucharest' })}
- Active Session: ${marketSession.name}
- Session Status: ${marketSession.status}
- Volatility Level: ${marketSession.volatility}
- Session Recommendation: ${marketSession.recommendation}

Provide a JSON response with this EXACT structure:
{
  "action": "BUY, SELL, or HOLD",
  "confidence": "integer from 10-95 based on your analysis",
  "entry": "number - your optimal entry level",
  "stopLoss": "number - your stop loss level",
  "takeProfit": "number - your take profit level",
  "support": "number - key support level you identify",
  "resistance": "number - key resistance level you identify", 
  "reasoning": "detailed explanation of your decision",
  "riskReward": "number - your calculated risk to reward ratio",
  "entryConditions": "string - specific trigger conditions for entry",
  "entryTiming": "string - timing guidance and session considerations",
  "volumeConfirmation": "string - volume requirements for entry",
  "candlestickSignals": "string - candlestick confirmation patterns to watch for"
}

DECISION GUIDELINES:
- You can agree or disagree with the algorithmic suggestion based on your analysis
- Use the enhanced technical data to make informed decisions
- Consider market context, session timing, and overall market structure
- Provide clear reasoning for your recommendations
- Base confidence on the strength of your analysis and market conditions`;

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
      temperature: 0.1,
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
    
    // Add algorithmic data to AI response for reference
    recommendation.algorithmicStrategy = algorithmicSuggestion.strategy;
    recommendation.algorithmicPositionSize = algorithmicSuggestion.positionSize;
    
    console.log('Successfully parsed AI recommendation:', recommendation);
    return recommendation;
    
  } catch (parseError) {
    console.log('AI analysis failed:', parseError.message);
    console.log('Raw AI Response:', analysisText);
    throw new Error('AI analysis unavailable');
  }
}
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
  const algorithmicSuggestion = calculateEntrySignal({
    currentPrice: currentData.currentPrice,
    technicalAnalysis,
    trendAnalysis,
    marketSession,
    atr: technicalAnalysis.atr
  });

  const openAIApiKey = Deno.env.get('OPEN_AI_API');
  if (!openAIApiKey) throw new Error('OpenAI API key not configured');

  const multiTimeframeContext = strategy === '1H+4H' && technicalAnalysis.multiTimeframe ? `
## MULTI-TIMEFRAME ANALYSIS (1H + 4H Strategy)
- Confluence Score: ${technicalAnalysis.multiTimeframe.confluence}%
- Trend Agreement: ${technicalAnalysis.multiTimeframe.agreement ? 'YES' : 'NO'}
- 4H Data: RSI=${technicalAnalysis.multiTimeframe.higher4h.rsi}, SMA10=${technicalAnalysis.multiTimeframe.higher4h.sma10}, Support=${technicalAnalysis.multiTimeframe.higher4h.support}, Resistance=${technicalAnalysis.multiTimeframe.higher4h.resistance}

**MULTI-TIMEFRAME REQUIREMENTS:**
- Only consider high-confidence trades when confluence score > 60%
- Both timeframes must align for trend-following strategies
- Use 4H levels for major S/R, 1H for precise entries
- Increase confidence significantly when both timeframes confirm signals
` : '';

  const strategyNote = strategy === '1H+4H' ? 'This analysis uses ENHANCED MULTI-TIMEFRAME strategy (1H + 4H)' : 'This analysis uses STANDARD 1H strategy';
  
  // Include enhanced features as compact JSON for the model to parse easily
  const enhancedJson = JSON.stringify(technicalAnalysis?.enhancedFeatures ?? {}, null, 2);

  const analysisPrompt = `
You are an expert forex trading analyst with 15+ years of experience. Analyze ${symbol} and provide a strategic trading recommendation.

${strategyNote}
${multiTimeframeContext}

ALGORITHMIC ASSISTANT REFERENCE:
- Suggested Strategy: ${algorithmicSuggestion.strategy}
- Suggested Action: ${algorithmicSuggestion.action}
- Calculated Entry: ${algorithmicSuggestion.entryPrice}
- Calculated SL/TP: ${algorithmicSuggestion.stopLoss} / ${algorithmicSuggestion.takeProfit}
- Risk/Reward: ${algorithmicSuggestion.riskRewardRatio}:1
- Reasoning: ${algorithmicSuggestion.reasoning.join('. ')}

ENHANCED MARKET DATA:
**Price Action:**
- Symbol: ${symbol} | Current: ${currentData.currentPrice}
- 24h: ${currentData.changePercent}% (High: ${currentData.high24h}, Low: ${currentData.low24h})

**Technical Indicators:**
- Moving Averages: SMA10=${technicalAnalysis.sma10}, SMA20=${technicalAnalysis.sma20}
- Momentum: RSI=${technicalAnalysis.rsi}, MACD=${technicalAnalysis.macd?.macd} (Signal: ${technicalAnalysis.macd?.signal}, Histogram: ${technicalAnalysis.macd?.histogram})
- Volatility: ATR=${technicalAnalysis.atr} (${technicalAnalysis.volatility?.atrPercentage}%), Status=${technicalAnalysis.volatility?.status}
- Bollinger: Upper=${technicalAnalysis.bollinger?.upper}, Middle=${technicalAnalysis.bollinger?.middle}, Lower=${technicalAnalysis.bollinger?.lower}
- Key Levels: Support=${technicalAnalysis.support}, Resistance=${technicalAnalysis.resistance}
- Pivots: R1=${technicalAnalysis.pivotPoints?.r1}, Pivot=${technicalAnalysis.pivotPoints?.pivot}, S1=${technicalAnalysis.pivotPoints?.s1}
- Fibonacci: 23.6%=${technicalAnalysis.fibonacci?.level236}, 38.2%=${technicalAnalysis.fibonacci?.level382}, 61.8%=${technicalAnalysis.fibonacci?.level618}
- Swings: High=${technicalAnalysis.swingLevels?.swingHigh}, Low=${technicalAnalysis.swingLevels?.swingLow}

**Enhanced Features (JSON):**
${enhancedJson}

**Trend & Pattern Analysis:**
- Trend: ${trendAnalysis.overallTrend} (Strength: ${trendAnalysis.trendStrength})
- Structure: Higher Highs=${trendAnalysis.higherHighs ? 'YES' : 'NO'}, Higher Lows=${trendAnalysis.higherLows ? 'YES' : 'NO'}
- Momentum: ${trendAnalysis.momentum}
- Patterns: ${trendAnalysis.candlePatterns}
- Volume: ${trendAnalysis.volumeTrend}

**Session Context:**
- Time: ${romaniaTime.toLocaleString('en-US', { timeZone: 'Europe/Bucharest', hour12: false })}
- Session: ${marketSession.name} (${marketSession.status})
- Volatility: ${marketSession.volatility} | Recommendation: ${marketSession.recommendation}

**CRITICAL ENTRY STRATEGY RULES:**
🚨 **STRATEGIC ENTRY PRIORITY - DO NOT DEFAULT TO CURRENT PRICE**
🎯 **ENTRY LEVEL SELECTION PRIORITY:**
1. **PULLBACK ENTRIES**: Wait for retracements to key support/resistance levels
2. **FIBONACCI RETRACEMENTS**: Use 38.2%, 50%, or 61.8% levels for entries
3. **MOVING AVERAGE TESTS**: Enter on pullbacks to SMA10, SMA20, or EMA levels
4. **BOLLINGER BAND EXTREMES**: Enter at upper/lower bands for mean reversion
5. **PIVOT POINT LEVELS**: Use daily pivots, S1/R1 for strategic entries
6. **SUPPORT/RESISTANCE RETESTS**: Enter on retests of broken levels
7. **CURRENT PRICE**: ONLY if immediate breakout momentum or no better levels available

**EXPERT ANALYSIS FRAMEWORK:**
1. **Technical Confluence:** Identify 3+ confirming signals from different indicator categories
2. **Risk Management:** Ensure R:R ratio ≥ 2:1, position at logical S/R levels
3. **Timing Precision:** Consider session volatility, news events, and momentum shifts
4. **Entry Strategy:** PRIORITIZE strategic levels over current price for limit orders
5. **Market Structure:** Use major S/R levels for entry, stop loss, and take profit placement

**CONFIDENCE SCORING:**
- 80-95%: Multiple strong confluences, clear direction, favorable session
- 60-79%: Good setup with some confirmation, acceptable risk
- 40-59%: Moderate setup, higher risk, requires tight management
- 20-39%: Weak setup, only consider if forced to choose direction

Respond with ONLY this JSON structure:
{
  "action": "BUY or SELL (must choose one - HOLD not allowed)",
  "confidence": "integer 20-95 based on technical confluence and market conditions",
  "entry": "number - STRATEGIC entry price (prefer pullback/retracement levels over current price ${currentData.currentPrice})",
  "stopLoss": "number - logical stop beyond key level",
  "takeProfit": "number - target at next major S/R or 2+ R:R",
  "support": "number - most critical support you identify",
  "resistance": "number - most critical resistance you identify",
  "reasoning": "detailed explanation referencing specific technical confluences and WHY you chose this entry level",
  "riskReward": "number - calculated R:R ratio (minimum 2.0)",
  "entryConditions": "specific trigger conditions for entry (candlestick patterns, level breaks, etc.)",
  "entryTiming": "session-specific timing guidance and liquidity considerations",
  "volumeConfirmation": "volume requirements and signals to confirm entry",
  "candlestickSignals": "specific candlestick patterns to watch for confirmation"
}

**CRITICAL REQUIREMENTS:**
- **ENTRY MUST BE STRATEGIC**: Choose pullback/retracement/technical levels, NOT current price (${currentData.currentPrice}) unless justified breakout
- Must explain WHY this entry level is better than current market price
- Risk/reward must be ≥ 2:1
- Consider session timing and volatility in your analysis
- Reference multiple timeframes if using 1H+4H strategy
- Justify strategic limit order approach over market execution`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        { role: 'system', content: 'You are an expert forex trading analyst with 15+ years of institutional trading experience. You MUST respond with ONLY valid JSON format. No explanatory text before or after. Start with { and end with }.' },
        { role: 'user', content: analysisPrompt }
      ],
      max_completion_tokens: 2000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error: ${response.statusText} - ${errorBody}`);
  }

  const aiResponse = await response.json();
  const analysisText = aiResponse.choices[0].message.content;
  
  try {
    const recommendation = JSON.parse(analysisText.trim());
    if (!recommendation.action || !recommendation.confidence || !recommendation.entry) {
      throw new Error('Missing required fields in AI response');
    }
    recommendation.algorithmicStrategy = algorithmicSuggestion.strategy;
    recommendation.algorithmicPositionSize = algorithmicSuggestion.positionSize;
    return recommendation;
  } catch (parseError) {
    console.error('AI analysis parsing failed:', parseError.message);
    console.error('Raw AI Response:', analysisText);
    throw new Error('AI analysis result was not valid JSON.');
  }
}
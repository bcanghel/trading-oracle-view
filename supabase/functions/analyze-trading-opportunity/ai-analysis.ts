import { calculateEntrySignal } from "./entry-logic.ts";
import { validateFundamentals } from "./fundamentals-validate.ts";
import { computeFundamentalBias } from "./fundamentals-bias.ts";

export async function analyzeWithAI(
  symbol: string,
  historicalData: any[],
  currentData: any,
  technicalAnalysis: any,
  trendAnalysis: any,
  marketSession: any,
  romaniaTime: Date,
  strategy: string = '1H',
  historical4hData: any[] | null = null,
  fundamentalsRaw?: any,
  aiProvider: 'claude' | 'openai' = 'claude'
) {
  const algorithmicSuggestion = calculateEntrySignal({
    currentPrice: currentData.currentPrice,
    technicalAnalysis,
    trendAnalysis,
    marketSession,
    atr: technicalAnalysis.atr
  });

  // Process fundamentals for USD pairs only
  const validation = fundamentalsRaw ? validateFundamentals(fundamentalsRaw) : null;
  if (validation && !validation.ok) {
    console.warn("Fundamentals validation issues:", validation.issues);
  }
  const fundamentals = validation?.ok ? validation.cleaned : undefined;
  const fundBias = fundamentals ? computeFundamentalBias(fundamentals) : null;

  // Provider selection based on parameter (not environment variable)
  const openAIApiKey = Deno.env.get('OPEN_AI_API');
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API');
  
  console.log(`Using AI Provider: ${aiProvider.toUpperCase()}`);
  
  if (aiProvider === 'claude' && !anthropicApiKey) {
    throw new Error('Anthropic API key not configured but Claude provider selected');
  } else if (aiProvider === 'openai' && !openAIApiKey) {
    throw new Error('OpenAI API key not configured but OpenAI provider selected');
  }

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

${fundBias ? `**USD FUNDAMENTALS ANALYSIS:**
- Overall Bias: ${fundBias.overallBias} (Strength: ${fundBias.strength}%)
- Summary: ${fundBias.summary}
- Key Events: ${fundBias.keyEvents.join(', ')}
- **IMPORTANT**: Factor this fundamental bias into your technical analysis confidence and direction bias.` : ''}

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

**STOP LOSS & TAKE PROFIT RULES (R:R targeting):**
- Anchor SL just beyond the logical invalidation level: for BUY below nearest swing low or SR zone edge; for SELL above nearest swing high or SR zone edge; add buffer ≥ 0.2×ATR.
- Do NOT default to 50 pips. Typical SL range is 30–50 pips on majors, but smaller is allowed if protected by structure.
- Take Profit should target R:R between 1.75 and 2.25 whenever structure allows; never exceed 2.5× risk and avoid < 1.5× unless no valid structure.
- Prefer TP at next major S/R, pivot, or Fibonacci level (38.2/50/61.8) that fits the target range; adjust to the closest qualifying level.
- Breakouts: SL beyond breakout with ≥ 0.2×ATR buffer; Trend/Pullbacks: SL beyond retested level.
- Sanity: |entry − current price| ≤ 2.5×ATR unless a confirmed breakout justifies otherwise.
- Precision: Round entry/SL/TP/support/resistance to realistic instrument precision (e.g., 5 decimals for non-JPY, 3 for JPY).

**EXPERT ANALYSIS FRAMEWORK:**
1. **Technical Confluence:** Identify 3+ confirming signals from different indicator categories
2. **Risk Management:** Target R:R 1.75–2.25 using structure-based TP; allow 1.5–2.5 bounds, never exceed 2.5
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
  "takeProfit": "number - target at next major S/R; aim R:R 1.75–2.25, never exceed 2.5 (min 1.5)",
  "support": "number - most critical support you identify",
  "resistance": "number - most critical resistance you identify",
  "reasoning": "detailed explanation referencing specific technical confluences and WHY you chose this entry level",
  "riskReward": "number - R:R in [1.5,2.5]; prefer 1.75–2.25",
  "entryConditions": "specific trigger conditions for entry (candlestick patterns, level breaks, etc.)",
  "entryTiming": "session-specific timing guidance and liquidity considerations",
  "volumeConfirmation": "volume requirements and signals to confirm entry",
  "candlestickSignals": "specific candlestick patterns to watch for confirmation"
}

**CRITICAL REQUIREMENTS:**
- **ENTRY MUST BE STRATEGIC**: Choose pullback/retracement/technical levels, NOT current price (${currentData.currentPrice}) unless justified breakout
- Must explain WHY this entry level is better than current market price
- Risk/reward must be within 1.5–2.5; prefer 1.75–2.25; never exceed 2.5
- Consider session timing and volatility in your analysis
- Reference multiple timeframes if using 1H+4H strategy
- Justify strategic limit order approach over market execution`;

  let response;
  
  if (aiProvider === 'claude') {
    console.log('Making request to Claude Opus 4.1...');
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey!,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-20250514',
        max_tokens: 2000,
        messages: [
          { 
            role: 'user', 
            content: `You are an expert forex trading analyst with 15+ years of institutional trading experience. You MUST respond with ONLY valid JSON format. No explanatory text before or after. Start with { and end with }.\n\n${analysisPrompt}` 
          }
        ]
      }),
    });
  } else {
    console.log('Making request to GPT-4.1...');
    response = await fetch('https://api.openai.com/v1/chat/completions', {
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
  }

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`${aiProvider.toUpperCase()} API Error:`, errorBody);
    throw new Error(`${aiProvider.toUpperCase()} API error: ${response.statusText} - ${errorBody}`);
  }

  const aiResponse = await response.json();
  let analysisText: string;
  
  if (aiProvider === 'claude') {
    analysisText = aiResponse.content[0].text;
    console.log('Claude response tokens used:', aiResponse.usage);
  } else {
    analysisText = aiResponse.choices[0].message.content;
    console.log('OpenAI response tokens used:', aiResponse.usage);
  }
  
  try {
    const recommendation = JSON.parse(analysisText.trim());
    if (!recommendation.action || !recommendation.confidence || !recommendation.entry) {
      throw new Error('Missing required fields in AI response');
    }
    recommendation.algorithmicStrategy = algorithmicSuggestion.strategy;
    recommendation.algorithmicPositionSize = algorithmicSuggestion.positionSize;
    recommendation.aiProvider = aiProvider;
    
    // Include fundamentals bias data if available
    if (fundBias) {
      recommendation.fundamentalsBias = fundBias;
    }
    
    console.log(`${aiProvider.toUpperCase()} analysis completed successfully`);
    return recommendation;
  } catch (parseError) {
    console.error(`${aiProvider.toUpperCase()} analysis parsing failed:`, parseError.message);
    console.error(`Raw ${aiProvider.toUpperCase()} Response:`, analysisText);
    throw new Error(`${aiProvider.toUpperCase()} analysis result was not valid JSON.`);
  }
}
import { calculateEntrySignal } from "./entry-logic.ts";
import { validateFundamentals } from "./fundamentals-validate.ts";
import { computeFundamentalBias } from "./fundamentals-bias.ts";
import { calculateOptimalEntryLevels } from "./entry-precision-engine.ts";

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

  // Calculate precise entry levels using the Entry Precision Engine
  const entryPrecisionAnalysis = calculateOptimalEntryLevels(
    symbol,
    currentData.currentPrice,
    technicalAnalysis,
    technicalAnalysis.enhancedFeatures || {},
    marketSession,
    technicalAnalysis.atr
  );

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

  // Create structured entry options for the LLM
  const buyOptionsText = entryPrecisionAnalysis.buyOptions.map((option, index) => 
    `BUY Option ${index + 1} (${option.classification}):
     - Entry: ${option.entryPrice} (${option.distanceInPips} pips from current)
     - Stop Loss: ${option.stopLoss}
     - Take Profit: ${option.takeProfit}
     - Risk/Reward: ${option.riskReward}:1
     - Confluence: ${option.confluence} levels
     - Strength: ${option.strength}%
     - Logic: ${option.reasoning.join('. ')}`
  ).join('\n\n');

  const sellOptionsText = entryPrecisionAnalysis.sellOptions.map((option, index) => 
    `SELL Option ${index + 1} (${option.classification}):
     - Entry: ${option.entryPrice} (${option.distanceInPips} pips from current)
     - Stop Loss: ${option.stopLoss}
     - Take Profit: ${option.takeProfit}
     - Risk/Reward: ${option.riskReward}:1
     - Confluence: ${option.confluence} levels
     - Strength: ${option.strength}%
     - Logic: ${option.reasoning.join('. ')}`
  ).join('\n\n');

  const analysisPrompt = `
You are an expert forex trading analyst with 15+ years of experience. Analyze ${symbol} and provide a strategic trading recommendation.

${strategyNote}
${multiTimeframeContext}

🎯 **ENTRY PRECISION ENGINE ANALYSIS** 🎯
The Entry Precision Engine has calculated mathematically optimal entry levels based on technical confluence:

**Consistency Score: ${entryPrecisionAnalysis.consistencyScore}%**
${entryPrecisionAnalysis.consistencyScore >= 70 ? '✅ High consistency - reliable levels' : entryPrecisionAnalysis.consistencyScore >= 50 ? '⚠️ Moderate consistency - use caution' : '❌ Low consistency - high uncertainty'}

**📈 BUY ENTRY OPTIONS:**
${buyOptionsText || 'No qualified BUY entries found'}

**📉 SELL ENTRY OPTIONS:**  
${sellOptionsText || 'No qualified SELL entries found'}

**🤖 ALGORITHMIC REFERENCE (Legacy - for comparison only):**
- Suggested Strategy: ${algorithmicSuggestion.strategy}
- Suggested Action: ${algorithmicSuggestion.action}
- Reference Entry: ${algorithmicSuggestion.entryPrice}
- Reference SL/TP: ${algorithmicSuggestion.stopLoss} / ${algorithmicSuggestion.takeProfit}

**CRITICAL**: You MUST choose from the Entry Precision Engine options above. Do NOT create your own entry prices.

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
- **IMPORTANT**: Factor this fundamental bias into your technical analysis confidence and direction bias.
- **REASONING REQUIREMENT**: In the "reasoning" field, include a short subsection titled "Fundamentals Integration" that explicitly states:
  - whether fundamentals align or conflict with the trade direction at the pair level (e.g., GBP/USD, not raw USD),
  - how this influenced confidence or risk management (e.g., slight confidence reduction, preference for tighter SL/position size),
  - mention 1–2 key drivers by name.` : ''}

**🎯 ENTRY PRECISION ENGINE RULES:**
🚨 **MANDATORY ENTRY SELECTION**
✅ **You MUST select from the Entry Precision Engine options provided above**
❌ **Do NOT create custom entry prices - use only the calculated options**
🔢 **All entry prices, stop losses, and take profits are pre-calculated with optimal R:R ratios**

**ENTRY SELECTION METHODOLOGY:**
1. **CHOOSE THE BEST OPTION**: Select the option with the highest confluence and strength
2. **CONSIDER MARKET CONDITIONS**: Factor in session volatility and momentum
3. **VALIDATE CONSISTENCY**: Higher consistency scores indicate more reliable setups
4. **RESPECT RISK MANAGEMENT**: All options already comply with 1.5-2.5 R:R requirements

**PRECISION ENGINE ADVANTAGES:**
- ✅ Mathematically consistent entry levels
- ✅ Multiple confluence confirmations  
- ✅ Pre-validated risk/reward ratios
- ✅ Distance-optimized for current session
- ✅ Time-independent accuracy (same analysis = same levels)

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
  "confidence": "integer 20-95 based on technical confluence and Entry Precision Engine consistency score",
  "entry": "number - MUST be from Entry Precision Engine options above (DO NOT create custom price)",
  "stopLoss": "number - use the stop loss from your selected Entry Precision Engine option",
  "takeProfit": "number - use the take profit from your selected Entry Precision Engine option", 
  "support": "number - most critical support you identify",
  "resistance": "number - most critical resistance you identify",
  "reasoning": "detailed explanation of which Entry Precision Engine option you selected and WHY based on technical analysis",
  "riskReward": "number - use the R:R from your selected Entry Precision Engine option",
  "selectedOption": "string - specify which option you selected (e.g., 'BUY Option 2 (PULLBACK)' or 'SELL Option 1 (STRATEGIC)')",
  "entryConditions": "specific trigger conditions for the selected entry level",
  "entryTiming": "session-specific timing guidance for the selected option",
  "volumeConfirmation": "volume requirements to confirm the selected entry",
  "candlestickSignals": "candlestick patterns to watch for at the selected entry level"
}

**🎯 MANDATORY REQUIREMENTS:**
- **USE PRECISION ENGINE OPTIONS**: Entry, SL, TP MUST match one of the options provided above
- **SPECIFY SELECTED OPTION**: Clearly state which option you chose (e.g., "BUY Option 2 (PULLBACK)")
- **EXPLAIN SELECTION**: Detail why this option is superior to others based on technical analysis
- **CONSISTENCY FACTOR**: Higher consistency scores (>70%) should increase confidence
- **NO CUSTOM PRICES**: Do not modify the pre-calculated entry, stop loss, or take profit levels`;

  let response;
  let aiModelUsed = '';
  
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
    console.log('Making request to GPT-5...');
    const endpoint = 'https://api.openai.com/v1/chat/completions';
    const headers = {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    };
    const baseMessages = [
      { role: 'system', content: 'You are an expert forex trading analyst with 15+ years of institutional trading experience. You MUST respond with ONLY valid JSON format. No explanatory text before or after. Start with { and end with }.' },
      { role: 'user', content: analysisPrompt }
    ];
    let model = 'gpt-5-2025-08-07';
    aiModelUsed = model;
    const payload = (m: string) => ({
      model: m,
      messages: baseMessages,
      max_completion_tokens: 2000,
      response_format: { type: "json_object" },
    });

    response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload(model)) });

    if (!response.ok) {
      const primaryBody = await response.text();
      console.error('OPENAI API Error (primary):', primaryBody);
      const shouldFallback = response.status === 404 || primaryBody.includes('model_not_found') || primaryBody.includes('must be verified') || primaryBody.includes('`gpt-5');
      if (shouldFallback) {
        console.warn('Falling back to GPT-4.1 due to model access error...');
        model = 'gpt-4.1-2025-04-14';
        aiModelUsed = model;
        response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload(model)) });
      } else {
        throw new Error(`OPENAI API error: ${response.statusText} - ${primaryBody}`);
      }
    }
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
    // Add Entry Precision Engine data to response
    recommendation.entryPrecisionAnalysis = entryPrecisionAnalysis;
    recommendation.algorithmicStrategy = algorithmicSuggestion.strategy;
    recommendation.algorithmicPositionSize = algorithmicSuggestion.positionSize;
    recommendation.aiProvider = aiProvider;
    recommendation.aiModel = aiModelUsed || (aiProvider === 'claude' ? 'claude-opus-4-20250514' : 'gpt-5-2025-08-07');
    
    // Validate that the AI selected a valid entry option
    validateEntrySelection(recommendation, entryPrecisionAnalysis);
    
// Include fundamentals bias data if available
if (fundBias) {
  recommendation.fundamentalsBias = fundBias;
  // Ensure the reasoning explicitly mentions how fundamentals were considered
  const reasonText = (String(recommendation.reasoning || '')).trim();
  const mentionsFundamentals = /fundamental/i.test(reasonText);
  if (!mentionsFundamentals) {
    const action = String(recommendation.action || '').toUpperCase();
    const aligns = (fundBias.overallBias === 'BULLISH' && action === 'BUY') || (fundBias.overallBias === 'BEARISH' && action === 'SELL');
    const key = Array.isArray(fundBias.keyEvents) && fundBias.keyEvents.length > 0 ? ` (key: ${fundBias.keyEvents.slice(0,2).join(', ')})` : '';
    const fundamentalsLine = `Fundamentals Integration: ${fundBias.summary}. This ${aligns ? 'aligns with' : 'conflicts with'} the ${action} setup${key}.`;
    recommendation.reasoning = reasonText ? `${reasonText}\n\n${fundamentalsLine}` : fundamentalsLine;
  }
} else if (fundamentalsRaw) {
  // Fundamentals were provided but did not pass validation → add neutral note
  const neutralSummary = 'Fundamentals provided but no qualified USD releases matched supported events within 14 days; treated as neutral.';
  recommendation.fundamentalsBias = {
    overallBias: 'NEUTRAL',
    strength: 0,
    summary: neutralSummary,
    keyEvents: []
  };
  const reasonText = (String(recommendation.reasoning || '')).trim();
  const fundamentalsLine = `Fundamentals Integration: ${neutralSummary}`;
  recommendation.reasoning = reasonText ? `${reasonText}\n\n${fundamentalsLine}` : fundamentalsLine;
}

console.log(`${aiProvider.toUpperCase()} analysis completed successfully`);
console.log(`Entry Precision Analysis - Consistency: ${entryPrecisionAnalysis.consistencyScore}%, Selected: ${recommendation.selectedOption || 'Not specified'}`);
return recommendation;
  } catch (parseError) {
    console.error(`${aiProvider.toUpperCase()} analysis parsing failed:`, parseError.message);
    console.error(`Raw ${aiProvider.toUpperCase()} Response:`, analysisText);
    throw new Error(`${aiProvider.toUpperCase()} analysis result was not valid JSON.`);
  }
}

function validateEntrySelection(recommendation: any, entryAnalysis: any): void {
  const selectedEntry = Number(recommendation.entry);
  const action = String(recommendation.action).toUpperCase();
  
  // Find matching option from entry precision analysis
  const relevantOptions = action === 'BUY' ? entryAnalysis.buyOptions : entryAnalysis.sellOptions;
  const matchingOption = relevantOptions.find((option: any) => 
    Math.abs(option.entryPrice - selectedEntry) < 0.00001
  );
  
  if (!matchingOption) {
    console.warn(`AI selected entry ${selectedEntry} not found in precision engine options. Available options:`, 
      relevantOptions.map((opt: any) => `${opt.entryPrice} (${opt.classification})`));
      
    // Force selection of recommended option if available
    const recommendedOption = action === 'BUY' ? entryAnalysis.recommendedBuyEntry : entryAnalysis.recommendedSellEntry;
    if (recommendedOption) {
      console.log(`Forcing selection of recommended ${action} option: ${recommendedOption.entryPrice}`);
      recommendation.entry = recommendedOption.entryPrice;
      recommendation.stopLoss = recommendedOption.stopLoss;
      recommendation.takeProfit = recommendedOption.takeProfit;
      recommendation.riskReward = recommendedOption.riskReward;
      recommendation.selectedOption = `${action} Recommended (${recommendedOption.classification}) - Auto-corrected`;
      
      // Update reasoning to explain the correction
      const originalReasoning = recommendation.reasoning || '';
      recommendation.reasoning = `${originalReasoning}\n\nNOTE: Entry was auto-corrected to match Entry Precision Engine recommendation due to invalid selection.`;
    }
  } else {
    // Ensure all related fields match the selected option
    if (Math.abs(recommendation.stopLoss - matchingOption.stopLoss) > 0.00001 ||
        Math.abs(recommendation.takeProfit - matchingOption.takeProfit) > 0.00001) {
      console.log(`Correcting SL/TP to match selected entry option`);
      recommendation.stopLoss = matchingOption.stopLoss;
      recommendation.takeProfit = matchingOption.takeProfit;
      recommendation.riskReward = matchingOption.riskReward;
    }
  }
}
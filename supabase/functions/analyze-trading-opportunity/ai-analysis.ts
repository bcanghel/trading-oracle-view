import { calculateEntrySignal } from "./entry-logic.ts";

export async function analyzeWithAI(
  symbol: string,
  historicalData: any[],
  currentData: any,
  technicalAnalysis: any,
  trendAnalysis: any,
  marketSession: any,
  romaniaTime: Date
) {
  // First, calculate algorithmic entry signal
  const entrySignal = calculateEntrySignal({
    currentPrice: currentData.currentPrice,
    technicalAnalysis,
    trendAnalysis,
    marketSession,
    atr: technicalAnalysis.atr
  });

  // If algorithmic system recommends HOLD, use minimal AI for market commentary
  if (entrySignal.action === 'HOLD') {
    return {
      action: 'HOLD',
      confidence: entrySignal.confidence,
      entry: entrySignal.entryPrice,
      stopLoss: entrySignal.stopLoss,
      takeProfit: entrySignal.takeProfit,
      support: technicalAnalysis.support,
      resistance: technicalAnalysis.resistance,
      reasoning: `Algorithmic analysis: ${entrySignal.reasoning.join('. ')}.`,
      riskReward: entrySignal.riskRewardRatio,
      entryConditions: 'Wait for clearer market structure and stronger technical confluence',
      entryTiming: `Current session: ${marketSession.name} - ${marketSession.status}`,
      volumeConfirmation: 'No specific volume requirements for hold position',
      candlestickSignals: 'Monitor for trend continuation or reversal patterns',
      strategy: entrySignal.strategy,
      positionSize: entrySignal.positionSize
    };
  }

  // For BUY/SELL signals, use AI for enhanced context and refinement
  const openAIApiKey = Deno.env.get('OPEN_AI_API');

  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Create enhanced analysis prompt with algorithmic foundation
  const analysisPrompt = `
You are providing REFINEMENT ONLY to a pre-calculated algorithmic trading signal. 

ALGORITHMIC FOUNDATION (DO NOT OVERRIDE):
- Strategy: ${entrySignal.strategy}
- Action: ${entrySignal.action}
- Entry Price: ${entrySignal.entryPrice}
- Stop Loss: ${entrySignal.stopLoss}
- Take Profit: ${entrySignal.takeProfit}
- Risk/Reward: ${entrySignal.riskRewardRatio}
- Algorithmic Confidence: ${entrySignal.confidence}%
- Reasoning: ${entrySignal.reasoning.join('. ')}

MARKET CONTEXT:
- Symbol: ${symbol}
- Current Price: ${currentData.currentPrice}
- ATR: ${technicalAnalysis.atr}
- RSI: ${technicalAnalysis.rsi}
- Support: ${technicalAnalysis.support}
- Resistance: ${technicalAnalysis.resistance}
- Session: ${marketSession.name} (${marketSession.status})

ENHANCED TECHNICAL DATA:
- MACD: ${technicalAnalysis.macd?.macd || 0}
- Bollinger Bands: ${technicalAnalysis.bollinger?.upper || 0}/${technicalAnalysis.bollinger?.lower || 0}
- Pivot Points: R1=${technicalAnalysis.pivotPoints?.r1 || 0}, S1=${technicalAnalysis.pivotPoints?.s1 || 0}
- Fibonacci Levels: 38.2%=${technicalAnalysis.fibonacci?.level382 || 0}, 61.8%=${technicalAnalysis.fibonacci?.level618 || 0}

YOUR TASK: Provide ONLY tactical refinements to the algorithmic signal. 

Return JSON with this EXACT structure:
{
  "action": "${entrySignal.action}",
  "confidence": ${entrySignal.confidence},
  "entry": ${entrySignal.entryPrice},
  "stopLoss": ${entrySignal.stopLoss},
  "takeProfit": ${entrySignal.takeProfit},
  "support": ${technicalAnalysis.support},
  "resistance": ${technicalAnalysis.resistance},
  "reasoning": "string - Brief refinement of algorithmic reasoning with market context",
  "riskReward": ${entrySignal.riskRewardRatio},
  "entryConditions": "string - Specific entry trigger refinements",
  "entryTiming": "string - Session timing considerations",
  "volumeConfirmation": "string - Volume confirmation requirements",
  "candlestickSignals": "string - Candlestick pattern confirmations"
}

CRITICAL RULES:
- DO NOT change action, entry, stopLoss, takeProfit, or confidence values
- Only provide tactical refinements to entry conditions and timing
- Keep reasoning concise and focused on market structure
- Base all refinements on the provided technical data`;

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
      temperature: 0.0,
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
    
    // Add algorithmic data to AI response
    recommendation.strategy = entrySignal.strategy;
    recommendation.positionSize = entrySignal.positionSize;
    
    console.log('Successfully parsed AI recommendation:', recommendation);
    return recommendation;
    
  } catch (parseError) {
    console.log('AI analysis failed:', parseError.message);
    console.log('Raw AI Response:', analysisText);
    throw new Error('AI analysis unavailable');
  }
}
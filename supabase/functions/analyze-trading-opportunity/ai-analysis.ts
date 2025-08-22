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

  // Helper: precision by symbol (simple heuristic)
  const getPrecisionForSymbol = (sym: string) => {
    if (/JPY/i.test(sym)) return { decimals: 3, pipSize: 0.01 };
    if (/XAU|GOLD|XAG|SILVER/i.test(sym)) return { decimals: 2, pipSize: 0.1 };
    return { decimals: 5, pipSize: 0.0001 };
  };

  const precision = getPrecisionForSymbol(symbol);

  // Build structured input JSON (compact)
  const input = {
    symbol,
    current: {
      price: currentData.currentPrice,
      high24h: currentData.high24h,
      low24h: currentData.low24h,
    },
    ta: {
      rsi: technicalAnalysis.rsi,
      atr: technicalAnalysis.atr,
      boll: technicalAnalysis.bollinger,
      macd: technicalAnalysis.macd,
      sma10: technicalAnalysis.sma10,
      sma20: technicalAnalysis.sma20,
      support: technicalAnalysis.support,
      resistance: technicalAnalysis.resistance,
    },
    enhanced: {
      ...(technicalAnalysis?.enhancedFeatures ?? {}),
    },
    trend: trendAnalysis,
    sessionContext: {
      minutesToEOD: (currentData?.sessionContext?.minutesToEOD ?? 600),
      session: (currentData?.sessionContext?.session ?? marketSession?.name ?? 'Unknown'),
      isWeekendOrHoliday: Boolean(currentData?.sessionContext?.isWeekendOrHoliday ?? false),
    },
    algo: {
      strategy: algorithmicSuggestion.strategy,
      action: algorithmicSuggestion.action,
      entry: algorithmicSuggestion.entryPrice,
      sl: algorithmicSuggestion.stopLoss,
      tp: algorithmicSuggestion.takeProfit,
      rr: algorithmicSuggestion.riskRewardRatio,
    },
    constraints: {
      allowFlat: false,
      minRr: 1.8,
      minConfluence: 50,
      strongConfluence: 60,
      minMinutesToEOD: 120,
      maxSpreadZ: 2.0,
      minActivityScore: -1.0,
      precision,
      confidenceMap: {
        base: 20,
        k: 0.7,
        bonusBreakout: 10,
        bonusTrend: 5,
        adrPenaltyThreshold: 80,
        adrPenalty: 10,
      },
    },
    strategyMode: strategy,
  };

  const system = `
You are a senior, risk-managed FX analyst. Output ONLY valid JSON per the provided schema.
Rules:
- Obey constraints: if allowFlat=true and any gate fails → action="FLAT".
- Never invent data; only use fields provided in "input".
- Entry must be a strategic level (SR zone edge, VWAP/EMA pullback, OR retest).
- Only use current price for confirmed breakout (enhanced.squeeze=true AND enhanced.or60.state="break").
- SL/TP must be ATR-based and beyond logical levels (SL outside zone by ≥0.2×ATR; TP at next major level or ≥minRr×ATR).
- Confidence must be derived from confluenceScore (see mapping in input.constraints).
- Respect instrument precision (decimals, pipSize) and round all price outputs accordingly.
- Hard gates: Do not trade if minutesToEOD < minMinutesToEOD, or spreadZ > maxSpreadZ, or activityScore < minActivityScore, or confluenceScore < minConfluence (unless allowForce=false).
- If strategyMode="1H+4H", do not go against bias4h unless confluenceScore ≥ strongConfluence.
- Prefer VWAP/EMA pullback entries in trend; prefer OR60 break/retest for breakouts; allow mean reversion only if distanceToSRZone ≤ 0.15×ATR and adrUsedToday ≤ 85.
- Confidence formula: confidence = clamp(base + k*confluenceScore + bonuses − penalties, 20, 90). Bonus: add bonusBreakout if enhanced.squeeze=true & enhanced.or60.state='break'; add bonusTrend if (enhanced.distToEMA100bps<0 and algo.action==='BUY' and enhanced.ema20Slope>0) or mirrored for SELL. Penalty: if adrUsedToday>adrPenaltyThreshold subtract adrPenalty.
- Price sanity: abs(entry - current.price) ≤ 2.5 × ta.atr unless breakout path triggered; SL must be outside nearest SR zone by ≥ 0.2 × ta.atr; TP ≥ minRr × abs(entry - stopLoss) and not beyond next major SR zone by more than 3 × ta.atr.
`;

  const response_format = {
    type: "json_schema",
    json_schema: {
      name: "fx_recommendation",
      schema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["BUY","SELL","FLAT"] },
          confidence: { type: "integer", minimum: 20, maximum: 95 },
          entry: { type: "number" },
          stopLoss: { type: "number" },
          takeProfit: { type: "number" },
          support: { type: "number" },
          resistance: { type: "number" },
          reasoning: { type: "string", minLength: 40 },
          riskReward: { type: "number", minimum: 1.5 },
          entryConditions: { type: "string" },
          entryTiming: { type: "string" },
          volumeConfirmation: { type: "string" },
          candlestickSignals: { type: "string" }
        },
        required: [
          "action","confidence","entry","stopLoss","takeProfit","support","resistance","reasoning","riskReward"
        ],
        additionalProperties: false
      },
      strict: true
    }
  } as const;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify({ input }) }
      ],
      response_format,
      max_completion_tokens: 800,
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

    // Round to instrument precision
    const d = precision.decimals;
    const round = (n: number) => parseFloat(Number(n).toFixed(d));
    recommendation.entry = round(recommendation.entry);
    recommendation.stopLoss = round(recommendation.stopLoss);
    recommendation.takeProfit = round(recommendation.takeProfit);
    recommendation.support = round(recommendation.support);
    recommendation.resistance = round(recommendation.resistance);

    // Optional blend with deterministic signal
    const dirAgree = recommendation.action === (algorithmicSuggestion.action === 'BUY' ? 'BUY' : (algorithmicSuggestion.action === 'SELL' ? 'SELL' : recommendation.action));
    const rrOk = Number(recommendation.riskReward) >= 1.8;
    if (!dirAgree || !rrOk) {
      recommendation.confidence = Math.max(20, Math.min(recommendation.confidence, 55));
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
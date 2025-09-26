import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { calculateTechnicalIndicators } from "./technical-indicators.ts";
import { analyzeTrend } from "./trend-analysis.ts";
import { getMarketSession } from "./market-sessions.ts";
import { analyzeWithAI } from "./ai-analysis.ts";
import { rateSetup, PriceMeta, TAJson, SignalContext } from "./confidence.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, historicalData, currentData, historical4hData = null, historical1dData = null, strategy = '1H', useDeterministic = false, fundamentals = null, aiProvider = 'claude' } = await req.json();

    // Enhanced analysis with new features
    const sessionContext = currentData.sessionContext || {};
    const currentPrice = parseFloat(currentData.currentPrice || currentData.close || 0);
    
    // Calculate enhanced technical features
    const { calculateEnhancedIndicators } = await import('./enhanced-indicators.ts');
    const enhancedFeatures = calculateEnhancedIndicators(
      historicalData, 
      historical4hData, 
      historical1dData,
      currentPrice,
      symbol,
      sessionContext
    );

    // Try deterministic analysis first (or if requested)
    let recommendation;
    const { generateDeterministicSignal } = await import('./deterministic-engine.ts');
    
    if (useDeterministic || (!Deno.env.get('OPEN_AI_API') && !Deno.env.get('ANTHROPIC_API'))) {
      // Fix parameter mismatch - deterministic engine expects different signature
      recommendation = generateDeterministicSignal(
        symbol,
        currentData,
        enhancedFeatures,
        sessionContext,
        currentPrice
      );
      
      if (!recommendation) {
        return new Response(
          JSON.stringify({
            error: 'No valid trading setup detected by deterministic engine',
            enhancedFeatures,
            success: false,
          }),
          {
            status: 422,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    } else {
      // Use AI analysis with selected provider
      const { analyzeWithAI } = await import('./ai-analysis.ts');
      
      try {
        recommendation = await analyzeWithAI(
          symbol,
          historicalData,
          currentData,
          { ...calculateTechnicalIndicators(historicalData), enhancedFeatures },
          analyzeTrend(historicalData),
          getMarketSession((new Date().getUTCHours() + 2) % 24),
          new Date(),
          strategy,
          historical4hData,
          fundamentals,
          aiProvider
        );
      } catch (aiError) {
        console.log('AI analysis failed, using deterministic fallback:', aiError instanceof Error ? aiError.message : String(aiError));
        
        recommendation = generateDeterministicSignal(
          symbol,
          currentData,
          enhancedFeatures,
          sessionContext,
          currentPrice
        );
        
        if (!recommendation) {
          return new Response(
            JSON.stringify({
              error: 'Both AI and deterministic analysis failed to generate signals',
              aiError: true,
              enhancedFeatures,
              success: false,
            }),
            {
              status: 422,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }
    }

    // Compute confidence scoring (session/news ignored; optimal session assumed)
    let confidenceScoring: any = null;
    try {
      const baseTA = calculateTechnicalIndicators(historicalData);
      const priceMeta: PriceMeta = { symbol, currentPrice, volumeType: "synthetic" };
      const taForScoring: TAJson = {
        atr: baseTA.atr,
        rsi: baseTA.rsi,
        macd: baseTA.macd,
        sma10: baseTA.sma10,
        sma20: baseTA.sma20,
        bollinger: baseTA.bollinger,
        resistance: baseTA.resistance,
        support: baseTA.support,
        volatility: baseTA.volatility,
        confidenceScore: baseTA.confidenceScore,
        enhancedFeatures,
      } as TAJson;

      const ctx: SignalContext = {
        side: (recommendation.action || "BUY") as any,
        entry: Number(recommendation.entry ?? currentPrice),
        sl: Number(recommendation.stopLoss ?? currentPrice),
        session: "London",
        redNewsSoon: false,
      };

      const openAIApiKey = Deno.env.get('OPEN_AI_API');
      const callLLM = async (systemPrompt: string, userJson: string) => {
        if (!openAIApiKey) {
          return JSON.stringify({
            ai_confidence_conditional: 0.62,
            delta_confidence: 0,
            delta_p_fill: 0,
            direction_agree: true,
            reasons: ["No OpenAI key available; using deterministic score only"],
          });
        }

        const endpoint = 'https://api.openai.com/v1/chat/completions';
        const headers = { 'Authorization': `Bearer ${openAIApiKey}`, 'Content-Type': 'application/json' };
        const payload = (model: string) => ({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userJson },
          ],
          max_completion_tokens: 800,
          response_format: { type: 'json_object' },
        });

        let resp = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload('gpt-5-2025-08-07')) });
        if (!resp.ok) {
          const body = await resp.text();
          console.warn('GPT-5 confidence call failed, falling back to GPT-4.1:', body);
          resp = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload('gpt-4.1-2025-04-14')) });
          const data2 = await resp.json();
          return data2.choices?.[0]?.message?.content ?? JSON.stringify({ ai_confidence_conditional: 0.6, delta_confidence: 0, direction_agree: true, reasons: ["Fallback default"] });
        }
        const data = await resp.json();
        return data.choices?.[0]?.message?.content ?? JSON.stringify({ ai_confidence_conditional: 0.6, delta_confidence: 0, direction_agree: true, reasons: ["Empty response"] });
      };

      const rated = await rateSetup(priceMeta, taForScoring, ctx, { useAI: true, callLLM, aiGateBand: [0.45, 0.70] });
      confidenceScoring = {
        combined: rated.combined_confidence,
        p_fill: rated.p_fill,
        deterministic: rated.deterministic,
        ai: rated.ai,
      };
    } catch (scErr) {
      console.error('Confidence scoring error:', scErr);
    }

    // Add Entry Precision Analysis to recommendation if not already present
    try {
      if (!recommendation.entryPrecisionAnalysis) {
        const { calculateOptimalEntryLevels } = await import('./entry-precision-engine.ts');
        const baseTA = calculateTechnicalIndicators(historicalData);
        
        const precisionAnalysis = calculateOptimalEntryLevels(
          symbol,
          currentPrice,
          baseTA,
          enhancedFeatures,
          sessionContext || {},
          enhancedFeatures.atr14 || enhancedFeatures.atr20 || 0.0075 // Reasonable fallback
        );
        recommendation.entryPrecisionAnalysis = precisionAnalysis;
      }
    } catch (precisionError) {
      console.warn('Entry precision analysis failed:', precisionError instanceof Error ? precisionError.message : String(precisionError));
      // Continue without precision analysis - don't break the main flow
    }

    // Include fundamentals analysis in response if available
    const response: any = {
      recommendation,
      technicalAnalysis: { 
        ...calculateTechnicalIndicators(historicalData),
        enhancedFeatures 
      },
      trendAnalysis: analyzeTrend(historicalData),
      marketSession: getMarketSession((new Date().getUTCHours() + 2) % 24),
      enhancedFeatures,
      entryPrecisionAnalysis: recommendation.entryPrecisionAnalysis || null, // Include entry precision data
      confidence: confidenceScoring,
      strategy,
      success: true,
    };

    // Add fundamentals data if it was processed
    if (fundamentals) {
      response.fundamentalsInput = fundamentals;
      response.fundamentalsBias = recommendation.fundamentalsBias || null;
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in analyze-trading-opportunity function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Helper functions for multi-timeframe analysis
function calculateTimeframeConfluence(ta1h: any, ta4h: any): number {
  let confluenceScore = 0;
  let totalChecks = 0;
  
  // RSI confluence (both in same zone)
  if ((ta1h.rsi < 30 && ta4h.rsi < 40) || (ta1h.rsi > 70 && ta4h.rsi > 60)) {
    confluenceScore += 20;
  }
  totalChecks += 20;
  
  // SMA alignment confluence
  if ((ta1h.sma10 > ta1h.sma20 && ta4h.sma10 > ta4h.sma20) || 
      (ta1h.sma10 < ta1h.sma20 && ta4h.sma10 < ta4h.sma20)) {
    confluenceScore += 25;
  }
  totalChecks += 25;
  
  // Support/Resistance proximity (within 0.5%)
  const supportDiff = Math.abs(ta1h.support - ta4h.support) / ta1h.support;
  const resistanceDiff = Math.abs(ta1h.resistance - ta4h.resistance) / ta1h.resistance;
  
  if (supportDiff < 0.005) confluenceScore += 15;
  if (resistanceDiff < 0.005) confluenceScore += 15;
  totalChecks += 30;
  
  // Bollinger Band alignment
  if ((ta1h.bollinger && ta4h.bollinger)) {
    const bb1hPos = ta1h.bollinger.position || 'middle';
    const bb4hPos = ta4h.bollinger.position || 'middle';
    if (bb1hPos === bb4hPos) confluenceScore += 25;
  }
  totalChecks += 25;
  
  return Math.round((confluenceScore / totalChecks) * 100);
}

function checkTrendAgreement(trend1h: any, trend4h: any): boolean {
  return trend1h.overallTrend === trend4h.overallTrend;
}
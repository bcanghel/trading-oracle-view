import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { calculateTechnicalIndicators } from "./technical-indicators.ts";
import { analyzeTrend } from "./trend-analysis.ts";
import { getMarketSession } from "./market-sessions.ts";
import { analyzeWithAI } from "./ai-analysis.ts";

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
      recommendation = generateDeterministicSignal(
        symbol,
        { historicalData, currentData, historical4hData },
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
        console.log('AI analysis failed, using deterministic fallback:', aiError.message);
        
        recommendation = generateDeterministicSignal(
          symbol,
          { historicalData, currentData, historical4hData },
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
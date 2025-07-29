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
    const { symbol, historicalData, currentData, historical4hData = null, strategy = '1H' } = await req.json();

    // Calculate technical indicators and trend analysis
    let technicalAnalysis, trendAnalysis, technicalAnalysis4h = null, trendAnalysis4h = null;
    
    if (strategy === '1H+4H' && historical4hData) {
      // Calculate for both timeframes
      technicalAnalysis = calculateTechnicalIndicators(historicalData);
      trendAnalysis = analyzeTrend(historicalData);
      technicalAnalysis4h = calculateTechnicalIndicators(historical4hData);
      trendAnalysis4h = analyzeTrend(historical4hData);
      
      // Merge analyses for multi-timeframe confidence
      technicalAnalysis.multiTimeframe = {
        confluence: calculateTimeframeConfluence(technicalAnalysis, technicalAnalysis4h),
        higher4h: technicalAnalysis4h,
        agreement: checkTrendAgreement(trendAnalysis, trendAnalysis4h)
      };
    } else {
      // Original 1H strategy
      technicalAnalysis = calculateTechnicalIndicators(historicalData);
      trendAnalysis = analyzeTrend(historicalData);
    }
    
    // Get current Romania time and market session info
    const romaniaTime = new Date();
    const romaniaHour = (romaniaTime.getUTCHours() + 2) % 24; // Romania is UTC+2 (UTC+3 in summer)
    const marketSession = getMarketSession(romaniaHour);
    
    let recommendation;
    try {
      recommendation = await analyzeWithAI(
        symbol,
        historicalData,
        currentData,
        technicalAnalysis,
        trendAnalysis,
        marketSession,
        romaniaTime,
        strategy,
        historical4hData
      );
    } catch (aiError) {
      console.log('AI analysis failed:', aiError.message);
      
      // Return error instead of fallback
      return new Response(
        JSON.stringify({
          error: 'AI analysis unavailable. Please try again.',
          aiError: true,
          success: false,
        }),
        {
          status: 422, // Unprocessable Entity
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        recommendation,
        technicalAnalysis,
        trendAnalysis,
        marketSession,
        strategy,
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
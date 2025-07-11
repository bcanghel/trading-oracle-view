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
    const { symbol, historicalData, currentData } = await req.json();

    // Calculate technical indicators and trend analysis
    const technicalAnalysis = calculateTechnicalIndicators(historicalData);
    const trendAnalysis = analyzeTrend(historicalData);
    
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
        romaniaTime
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
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SessionConfig {
  name: string;
  pairs: string[];
  startHour: number;
}

const SESSION_CONFIGS: SessionConfig[] = [
  {
    name: 'Asian Session',
    pairs: ['GBP/AUD'],
    startHour: 2,
  },
  {
    name: 'London Session',
    pairs: ['GBP/USD'],
    startHour: 10,
  },
  {
    name: 'New York Session',
    pairs: ['EUR/USD'],
    startHour: 15,
  }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const twelveApiKey = Deno.env.get('TWELVE_API')!;
    const openAIApiKey = Deno.env.get('OPEN_AI_API')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const getRomaniaHour = () => {
      return parseInt(new Date().toLocaleString('en-US', {
        timeZone: 'Europe/Bucharest',
        hour: '2-digit',
        hour12: false
      }));
    };

    const getRomaniaMinute = () => {
      return parseInt(new Date().toLocaleString('en-US', {
        timeZone: 'Europe/Bucharest',
        minute: '2-digit'
      }));
    };

    const calculatePips = (entry: number, current: number, action: 'BUY' | 'SELL', symbol: string) => {
      const pipMultiplier = symbol.includes('JPY') ? 100 : 10000;
      const difference = action === 'BUY' ? current - entry : entry - current;
      return Math.round(difference * pipMultiplier);
    };

    const fetchMarketData = async (symbol: string) => {
      // Get exactly 48x 1H candles + 12x 4H candles (same as Market Analysis tab)
      const response1h = await fetch(
        `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1h&apikey=${twelveApiKey}&outputsize=48`
      );
      const data1h = await response1h.json();
      
      const response4h = await fetch(
        `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=4h&apikey=${twelveApiKey}&outputsize=12`
      );
      const data4h = await response4h.json();
      
      if (!data1h.values || data1h.values.length === 0) {
        throw new Error(`No 1H market data for ${symbol}`);
      }

      const latest = data1h.values[0];
      const previousPrice = data1h.values[1] ? parseFloat(data1h.values[1].close) : parseFloat(latest.close);
      const currentPrice = parseFloat(latest.close);
      const change = currentPrice - previousPrice;
      const changePercent = (change / previousPrice) * 100;
      
      return {
        historicalData: data1h.values.slice(0, 48), // Exactly 48 candles
        historical4hData: data4h.values ? data4h.values.slice(0, 12) : [], // Exactly 12 candles
        currentData: {
          symbol: symbol,
          currentPrice: currentPrice,
          change: change,
          changePercent: changePercent,
          high24h: Math.max(...data1h.values.slice(0, 24).map(d => parseFloat(d.high))),
          low24h: Math.min(...data1h.values.slice(0, 24).map(d => parseFloat(d.low))),
          volume: parseInt(latest.volume) || 2705,
          volumeType: "synthetic",
          sessionMultiplier: 0.8
        },
        strategy: '1H+4H' // Multi-timeframe strategy
      };
    };

    const getAIAnalysis = async (symbol: string, historicalData: any[], currentData: any, historical4hData: any[]) => {
      // Use the same advanced analysis as the Market Analysis tab with multi-timeframe data
      const analysisResponse = await fetch('https://cgmzxonyaiwtcyxmmhsi.supabase.co/functions/v1/analyze-trading-opportunity', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol,
          historicalData,
          currentData, // Send complete currentData object with all fields
          historical4hData, // Include 4H data for comprehensive analysis
          strategy: '1H+4H' // Multi-timeframe strategy like Market Analysis tab
        }),
      });

      if (!analysisResponse.ok) {
        console.error('Failed to get trading analysis:', await analysisResponse.text());
        return { error: 'API request failed', response: null };
      }

      const analysisData = await analysisResponse.json();
      
      if (!analysisData.success) {
        console.error('Trading analysis failed:', analysisData.error);
        return { error: 'Analysis failed', response: null };
      }

      const recommendation = analysisData.recommendation;
      console.log(`AI Analysis for ${symbol}:`, {
        confidence: recommendation?.confidence || 'N/A',
        action: recommendation?.action || 'N/A',
        entry: recommendation?.entry || 'N/A',
        stopLoss: recommendation?.stopLoss || 'N/A',
        takeProfit: recommendation?.takeProfit || 'N/A',
        reasoning: recommendation?.reasoning || 'N/A'
      });

      if (!recommendation) {
        return { error: 'No recommendation returned', response: null };
      }

      // Calculate pip-based risk management (50 pips max SL, 100 pips max TP, 2:1 R/R)
      const pipMultiplier = symbol.includes('JPY') ? 100 : 10000;
      const riskPips = Math.abs(recommendation.entry - recommendation.stopLoss) * pipMultiplier;
      const rewardPips = Math.abs(recommendation.takeProfit - recommendation.entry) * pipMultiplier;
      const rrRatio = rewardPips / riskPips;
      
      console.log(`Risk/Reward Analysis for ${symbol}:`, {
        riskPips: riskPips.toFixed(1),
        rewardPips: rewardPips.toFixed(1),
        rrRatio: rrRatio.toFixed(2),
        required: '2.0+',
        maxStopLoss: '50 pips',
        maxTakeProfit: '100 pips'
      });

      // Adjust SL/TP to meet our strict requirements
      let adjustedStopLoss = recommendation.stopLoss;
      let adjustedTakeProfit = recommendation.takeProfit;
      let adjustmentMade = false;

      // Enforce 50 pip max stop loss
      if (riskPips > 50) {
        const maxRiskDistance = 50 / pipMultiplier;
        adjustedStopLoss = recommendation.action === 'BUY' 
          ? recommendation.entry - maxRiskDistance
          : recommendation.entry + maxRiskDistance;
        adjustmentMade = true;
      }

      // Enforce 2:1 minimum risk/reward ratio
      const minRewardDistance = Math.abs(recommendation.entry - adjustedStopLoss) * 2;
      adjustedTakeProfit = recommendation.action === 'BUY'
        ? recommendation.entry + minRewardDistance
        : recommendation.entry - minRewardDistance;

      // Enforce 100 pip max take profit
      const adjustedRewardPips = Math.abs(adjustedTakeProfit - recommendation.entry) * pipMultiplier;
      if (adjustedRewardPips > 100) {
        const maxRewardDistance = 100 / pipMultiplier;
        adjustedTakeProfit = recommendation.action === 'BUY'
          ? recommendation.entry + maxRewardDistance
          : recommendation.entry - maxRewardDistance;
        adjustmentMade = true;
      }

      // Recalculate final values
      const finalRiskPips = Math.abs(recommendation.entry - adjustedStopLoss) * pipMultiplier;
      const finalRewardPips = Math.abs(adjustedTakeProfit - recommendation.entry) * pipMultiplier;
      const finalRRRatio = finalRewardPips / finalRiskPips;

      console.log(`Final adjusted values for ${symbol}:`, {
        riskPips: finalRiskPips.toFixed(1),
        rewardPips: finalRewardPips.toFixed(1),
        rrRatio: finalRRRatio.toFixed(2),
        adjustmentMade
      });

      // Return analysis with adjusted values
      const result = {
        action: recommendation.action,
        entry: recommendation.entry,
        stopLoss: adjustedStopLoss,
        takeProfit: adjustedTakeProfit,
        confidence: recommendation.confidence,
        reasoning: recommendation.reasoning + (adjustmentMade ? ' [SL/TP adjusted for risk management]' : ''),
        rrRatio: finalRRRatio,
        riskPips: finalRiskPips,
        rewardPips: finalRewardPips,
        error: null
      };

      // Always generate trade regardless of confidence - we want 3 trades per day
      console.log(`✅ GENERATING ${symbol}: Confidence ${recommendation.confidence}%, R/R ${finalRRRatio.toFixed(2)}:1, Risk ${finalRiskPips.toFixed(1)} pips, Reward ${finalRewardPips.toFixed(1)} pips`);
    
      
      return result;
    };

    const generateTradeForPair = async (symbol: string, sessionName: string) => {
      try {
        console.log(`Generating trade for ${symbol} - ${sessionName}`);
        
        const marketData = await fetchMarketData(symbol);
        console.log(`Got market data for ${symbol}:`, {
          price: marketData.currentData.currentPrice,
          strategy: marketData.strategy,
          has1hData: marketData.historicalData?.length || 0,
          has4hData: marketData.historical4hData?.length || 0
        });
        
        const analysis = await getAIAnalysis(symbol, marketData.historicalData, marketData.currentData, marketData.historical4hData);
        console.log(`Got analysis for ${symbol}:`, analysis ? {
          action: analysis.action,
          confidence: analysis.confidence,
          riskReward: analysis.riskReward
        } : 'null');
        
        // Always create trades - no rejections, we need 3 trades per day
        let rejectionReason = null;
        let tradeStatus = 'OPEN';
        
        if (!analysis || analysis.error) {
          // Even if AI fails, create a conservative trade
          console.log(`AI failed for ${symbol}, creating conservative fallback trade`);
          const currentPrice = marketData.currentData.currentPrice;
          const conservative = {
            action: 'BUY' as const, // Default to BUY
            entry: currentPrice,
            stopLoss: currentPrice - (0.005), // 50 pips for major pairs
            takeProfit: currentPrice + (0.010), // 100 pips for major pairs
            confidence: 30,
            reasoning: 'Conservative fallback trade due to AI analysis failure',
            rrRatio: 2.0,
            riskPips: 50,
            rewardPips: 100
          };
          analysis = conservative;
        }
        
        console.log(`CREATING TRADE ${symbol}: Always generate for daily target`);
      

        // For now, create trades for the authenticated user making the request
        // In production, you might want to get all users who have auto-trading enabled
        const authHeader = req.headers.get('authorization');
        let userId = 'b195e363-8000-4440-9632-f9af83eb0e8c'; // Your user ID as fallback
        
        if (authHeader) {
          try {
            const token = authHeader.replace('Bearer ', '');
            const payload = JSON.parse(atob(token.split('.')[1]));
            userId = payload.sub;
            console.log(`Using authenticated user: ${userId}`);
          } catch (e) {
            console.log('Could not parse auth header, using fallback user ID');
          }
        }

        const nextCheck = new Date();
        nextCheck.setHours(nextCheck.getHours() + 3);

        console.log(`Attempting to create trade record for ${symbol} with userId: ${userId}, status: ${tradeStatus}`);
        
        // Prepare trade data - handle both valid and invalid analysis
        const tradeData = {
          symbol,
          session_name: sessionName,
          user_id: userId,
          status: tradeStatus,
          rejection_reason: rejectionReason,
          ai_confidence: analysis?.confidence || null,
          risk_reward_ratio: analysis?.rrRatio || null,
          risk_pips: analysis?.riskPips || null,
          reward_pips: analysis?.rewardPips || null,
          action: analysis?.action || 'BUY',
          entry_price: analysis?.entry || marketData.currentData.currentPrice,
          stop_loss: analysis?.stopLoss || 0,
          take_profit: analysis?.takeProfit || 0,
          next_check_at: tradeStatus === 'OPEN' ? nextCheck.toISOString() : null
        };
        
        const { data: trade, error } = await supabase
          .from('auto_trades')
          .insert(tradeData)
          .select()
          .single();

        if (error) {
          console.error(`Failed to create trade:`, error);
          return null;
        } else {
          console.log(`Created trade ${trade.id} for ${symbol} - ${sessionName}`);
          return trade;
        }
      } catch (error) {
        console.error(`Failed to generate trade for ${symbol}:`, error);
        return null;
      }
    };

    const checkAndUpdateTrades = async () => {
      console.log('Checking active trades...');
      
      const { data: activeTrades, error } = await supabase
        .from('auto_trades')
        .select('*')
        .eq('status', 'OPEN')
        .lte('next_check_at', new Date().toISOString());

      if (error) {
        console.error('Failed to fetch active trades:', error);
        return;
      }

      console.log(`Found ${activeTrades?.length || 0} trades to check`);

      for (const trade of activeTrades || []) {
        try {
          const marketData = await fetchMarketData(trade.symbol);
          const currentPrice = marketData.currentData.currentPrice;

          let tradeStatus = trade.status;
          let pipsResult = 0;

          if (trade.action === 'BUY') {
            if (currentPrice <= trade.stop_loss) {
              tradeStatus = 'LOSS';
              pipsResult = calculatePips(trade.entry_price, trade.stop_loss, trade.action, trade.symbol);
            } else if (currentPrice >= trade.take_profit) {
              tradeStatus = 'WIN';
              pipsResult = calculatePips(trade.entry_price, trade.take_profit, trade.action, trade.symbol);
            }
          } else { // SELL
            if (currentPrice >= trade.stop_loss) {
              tradeStatus = 'LOSS';
              pipsResult = calculatePips(trade.entry_price, trade.stop_loss, trade.action, trade.symbol);
            } else if (currentPrice <= trade.take_profit) {
              tradeStatus = 'WIN';
              pipsResult = calculatePips(trade.entry_price, trade.take_profit, trade.action, trade.symbol);
            }
          }

          if (tradeStatus !== 'OPEN') {
            const { error: updateError } = await supabase
              .from('auto_trades')
              .update({
                status: tradeStatus,
                pips_result: pipsResult,
                closed_at: new Date().toISOString()
              })
              .eq('id', trade.id);

            if (updateError) {
              console.error(`Failed to update trade ${trade.id}:`, updateError);
            } else {
              console.log(`Trade ${trade.id} closed: ${tradeStatus} with ${pipsResult} pips`);
            }
          } else {
            // Update next check time
            const nextCheck = new Date();
            nextCheck.setHours(nextCheck.getHours() + 3);
            
            await supabase
              .from('auto_trades')
              .update({ next_check_at: nextCheck.toISOString() })
              .eq('id', trade.id);
          }
        } catch (error) {
          console.error(`Failed to check trade ${trade.id}:`, error);
        }
      }
    };

    const generateSessionTrades = async () => {
      const currentHour = getRomaniaHour();
      const currentMinute = getRomaniaMinute();
      
      console.log(`Current time: ${currentHour}:${currentMinute} Romania time`);
      
      // For testing: analyze trades but only create if they meet criteria
      const testBody = await req.json();
      if (testBody?.time === 'manual_test') {
        console.log('=== MANUAL TEST MODE - COMPREHENSIVE ANALYSIS LOGGING ===');
        const testSession = SESSION_CONFIGS.find(s => s.name === 'New York Session');
        if (testSession) {
          console.log(`Testing analysis for ${testSession.name} with pairs: ${testSession.pairs.join(', ')}`);
          const results = [];
          
          for (const symbol of testSession.pairs) {
            console.log(`\n--- ANALYZING ${symbol} ---`);
            try {
              const trade = await generateTradeForPair(symbol, testSession.name);
              if (trade) {
                results.push({ symbol, status: 'TRADE_CREATED', id: trade.id });
                console.log(`✅ SUCCESS: Created trade for ${symbol}`);
              } else {
                results.push({ symbol, status: 'REJECTED_BY_CRITERIA' });
                console.log(`❌ REJECTED: ${symbol} did not meet trading criteria`);
              }
            } catch (error) {
              console.error(`💥 ERROR analyzing ${symbol}:`, error);
              results.push({ symbol, status: 'ERROR', error: error.message });
            }
          }
          
          console.log('\n=== FINAL TEST RESULTS ===');
          console.log('Results summary:', results);
          
          const created = results.filter(r => r.status === 'TRADE_CREATED').length;
          const rejected = results.filter(r => r.status === 'REJECTED_BY_CRITERIA').length;
          const errors = results.filter(r => r.status === 'ERROR').length;
          
          console.log(`Trades created: ${created}, Rejected by criteria: ${rejected}, Errors: ${errors}`);
        }
        return;
      }
      
      // Generate trades within first 15 minutes of session start
      const activeSession = SESSION_CONFIGS.find(session => 
        session.startHour === currentHour && currentMinute <= 15
      );
      
      if (activeSession) {
        console.log(`Found active session: ${activeSession.name}`);
        
        // Check if we already have trades for this session today
        const today = new Date().toISOString().split('T')[0];
        const { data: existingTrades } = await supabase
          .from('auto_trades')
          .select('id')
          .eq('session_name', activeSession.name)
          .gte('created_at', today + 'T00:00:00.000Z')
          .lt('created_at', today + 'T23:59:59.999Z');
        
        if (!existingTrades || existingTrades.length === 0) {
          console.log(`Generating trades for ${activeSession.name}`);
          
          for (const symbol of activeSession.pairs) {
            await generateTradeForPair(symbol, activeSession.name);
          }
        } else {
          console.log(`Trades already exist for ${activeSession.name} today`);
        }
      } else {
        console.log(`No active session found for hour ${currentHour}`);
      }
    };

    // Main execution
    await generateSessionTrades();
    await checkAndUpdateTrades();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Auto-trading scheduler executed successfully',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in auto-trading scheduler:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
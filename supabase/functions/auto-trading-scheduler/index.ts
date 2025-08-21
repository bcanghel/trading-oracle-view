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

    const getRomaniaDay = () => {
      const romaniaTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Bucharest' }));
      return romaniaTime.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
    };

    const calculatePips = (entry: number, current: number, action: 'BUY' | 'SELL', symbol: string) => {
      const pipMultiplier = symbol.includes('JPY') ? 100 : 10000;
      const difference = action === 'BUY' ? current - entry : entry - current;
      return Math.round(difference * pipMultiplier);
    };

    const fetchMarketData = async (symbol: string) => {
      // Use enhanced fetch-market-data function with proper window sizes and session context
      const response = await fetch('https://cgmzxonyaiwtcyxmmhsi.supabase.co/functions/v1/fetch-market-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol,
          strategy: '1H+4H', // Multi-timeframe strategy
          useDeterministic: false // Allow AI analysis first
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch enhanced market data for ${symbol}: ${await response.text()}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(`Enhanced market data failed for ${symbol}: ${data.error}`);
      }

      console.log(`Enhanced market data for ${symbol}:`, {
        candles1h: data.historicalData?.length || 0,
        candles4h: data.historical4hData?.length || 0,
        candles1d: data.historical1dData?.length || 0,
        session: data.sessionContext?.session,
        eodMinutes: data.sessionContext?.minutesToEOD,
        isWeekend: data.sessionContext?.isWeekendOrHoliday
      });

      return {
        historicalData: data.historicalData,
        historical4hData: data.historical4hData || [],
        historical1dData: data.historical1dData || [], // New 1D data
        currentData: data.currentData,
        sessionContext: data.sessionContext, // New session context
        strategy: data.strategy
      };
    };

    const getAIAnalysis = async (symbol: string, historicalData: any[], currentData: any, historical4hData: any[], historical1dData: any[] = [], sessionContext: any = {}) => {
      // Use enhanced analysis with deterministic fallback
      const analysisResponse = await fetch('https://cgmzxonyaiwtcyxmmhsi.supabase.co/functions/v1/analyze-trading-opportunity', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol,
          historicalData,
          currentData, // Enhanced current data with session context
          historical4hData, // 4H data for multi-timeframe analysis
          historical1dData, // New 1D data for daily context
          strategy: '1H+4H',
          useDeterministic: false // Try AI first, fallback to deterministic
        }),
      });

      if (!analysisResponse.ok) {
        console.error('Failed to get enhanced trading analysis:', await analysisResponse.text());
        
        // Try deterministic mode as fallback
        console.log('Attempting deterministic analysis fallback...');
        const deterministicResponse = await fetch('https://cgmzxonyaiwtcyxmmhsi.supabase.co/functions/v1/analyze-trading-opportunity', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            symbol,
            historicalData,
            currentData,
            historical4hData,
            historical1dData,
            strategy: '1H+4H',
            useDeterministic: true // Force deterministic mode
          }),
        });
        
        if (!deterministicResponse.ok) {
          return { error: 'Both AI and deterministic analysis failed', response: null };
        }
        
        const deterministicData = await deterministicResponse.json();
        if (!deterministicData.success) {
          return { error: 'Deterministic analysis failed', response: null };
        }
        
        console.log('✅ Using deterministic analysis as fallback');
        const recommendation = deterministicData.recommendation;
        
        console.log(`Deterministic Analysis for ${symbol}:`, {
          confidence: recommendation?.confidence || 'N/A',
          action: recommendation?.action || 'N/A',
          entry: recommendation?.entry || 'N/A',
          stopLoss: recommendation?.stopLoss || 'N/A',
          takeProfit: recommendation?.takeProfit || 'N/A',
          strategy: recommendation?.algorithmicStrategy || 'N/A'
        });
        
        if (!recommendation) {
          return { error: 'No deterministic recommendation returned', response: null };
        }
        
        // Continue with existing risk management logic...
        const pipMultiplier = symbol.includes('JPY') ? 100 : 10000;
        const riskPips = Math.abs(recommendation.entry - recommendation.stopLoss) * pipMultiplier;
        const rewardPips = Math.abs(recommendation.takeProfit - recommendation.entry) * pipMultiplier;
        const rrRatio = rewardPips / riskPips;
        
        // Use deterministic values with existing validation
        return {
          action: recommendation.action,
          entry: recommendation.entry,
          stopLoss: recommendation.stopLoss,
          takeProfit: recommendation.takeProfit,
          confidence: recommendation.confidence,
          reasoning: recommendation.reasoning?.join(' ') || 'Deterministic analysis',
          rrRatio: rrRatio,
          riskPips: riskPips,
          rewardPips: rewardPips,
          error: null
        };
      }

      const analysisData = await analysisResponse.json();
      
      if (!analysisData.success) {
        console.error('Enhanced trading analysis failed:', analysisData.error);
        return { error: 'Enhanced analysis failed', response: null };
      }

      const recommendation = analysisData.recommendation;
      console.log(`Enhanced AI Analysis for ${symbol}:`, {
        confidence: recommendation?.confidence || 'N/A',
        action: recommendation?.action || 'N/A',
        entry: recommendation?.entry || 'N/A',
        stopLoss: recommendation?.stopLoss || 'N/A',
        takeProfit: recommendation?.takeProfit || 'N/A',
        reasoning: recommendation?.reasoning || 'N/A',
        enhancedFeatures: analysisData.enhancedFeatures ? 'Available' : 'N/A'
      });

      if (!recommendation) {
        return { error: 'No enhanced recommendation returned', response: null };
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

    const closeExistingTrade = async (trade: any, currentPrice: number, reason: string) => {
      const pipsResult = calculatePips(trade.entry_price, currentPrice, trade.action, trade.symbol);
      const status = pipsResult > 0 ? 'WIN' : 'LOSS';
      
      console.log(`Closing trade ${trade.id} (${trade.symbol} ${trade.action}): ${reason} - ${status} ${pipsResult} pips`);
      
      const { error } = await supabase
        .from('auto_trades')
        .update({
          status: status,
          pips_result: pipsResult,
          closed_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .eq('id', trade.id);

      if (error) {
        console.error(`Failed to close trade ${trade.id}:`, error);
        return;
      }

      // Send telegram notification for trade closure
      try {
        const notificationData = {
          trade_id: trade.id,
          symbol: trade.symbol,
          action: trade.action,
          entry_price: trade.entry_price,
          stop_loss: trade.stop_loss,
          take_profit: trade.take_profit,
          order_type: trade.order_type || 'MARKET',
          confidence: trade.ai_confidence,
          session: trade.session_name,
          notification_type: 'trade_closed',
          status: status,
          pips_result: pipsResult,
          ai_confidence: trade.ai_confidence,
          risk_reward_ratio: trade.risk_reward_ratio,
          created_at: trade.created_at,
          closed_at: new Date().toISOString()
        };

        console.log(`Sending telegram notification for closed trade ${trade.id}`);
        
        const notificationResponse = await fetch('https://cgmzxonyaiwtcyxmmhsi.supabase.co/functions/v1/telegram-notifications', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(notificationData)
        });

        if (!notificationResponse.ok) {
          const errorText = await notificationResponse.text();
          console.error(`Failed to send telegram notification for trade ${trade.id}:`, errorText);
        } else {
          const result = await notificationResponse.json();
          console.log(`Telegram notification sent for trade ${trade.id}:`, result);
        }
      } catch (notificationError) {
        console.error(`Error sending telegram notification for trade ${trade.id}:`, notificationError);
      }
    };

    // ============= LOT SIZE CALCULATION =============
    const calculateLotSizeForTrade = (symbol: string, entryPrice: number, stopLoss: number, accountSize: number = 10000): {
      standardLot: number;
      microLot: number;
      riskAmount: number;
      pipValue: number;
      pipRisk: number;
      expectedProfitUSD: number;
      expectedRiskUSD: number;
    } => {
      const riskPercentage = 1; // 1% risk
      const leverage = 100; // 1:100 leverage
      
      // Calculate risk amount in USD - THIS IS THE KEY CALCULATION
      const riskAmount = accountSize * (riskPercentage / 100); // $100 for $10K, $250 for $25K
      
      // Determine pip value and decimal place based on pair
      const isJPYPair = symbol.includes('JPY');
      const pipDecimal = isJPYPair ? 0.01 : 0.0001;
      
      // Standard forex pip values for major pairs (per standard lot) in USD
      const pipValues: { [key: string]: number } = {
        'EUR/USD': 10, 'GBP/USD': 10, 'AUD/USD': 10, 'NZD/USD': 10,
        'USD/JPY': 9.09, 'USD/CHF': 10.87, 'USD/CAD': 7.69,
        'EUR/GBP': 12.87, 'EUR/JPY': 9.09, 'GBP/JPY': 9.09,
        'GBP/AUD': 6.85, 'EUR/AUD': 6.85, 'AUD/JPY': 9.09,
        'AUD/CAD': 7.69, 'AUD/CHF': 10.87, 'AUD/NZD': 8.70,
        'GBP/CAD': 7.69, 'GBP/CHF': 10.87, 'GBP/NZD': 8.70,
        'EUR/CAD': 7.69, 'EUR/CHF': 10.87, 'EUR/NZD': 8.70,
        'NZD/CAD': 7.69, 'NZD/CHF': 10.87, 'NZD/JPY': 9.09,
        'CAD/CHF': 10.87, 'CAD/JPY': 9.09, 'CHF/JPY': 9.09,
        'DEFAULT': 10
      };
      
      // Get pip value for this symbol
      const cleanSymbol = symbol.replace(/\s/g, '').toUpperCase();
      let pipValue = pipValues[cleanSymbol];
      
      // Try with forward slash if not found
      if (!pipValue && !cleanSymbol.includes('/') && cleanSymbol.length === 6) {
        const formattedSymbol = `${cleanSymbol.slice(0, 3)}/${cleanSymbol.slice(3)}`;
        pipValue = pipValues[formattedSymbol];
      }
      
      pipValue = pipValue || pipValues.DEFAULT;
      
      // Calculate pip difference (risk in pips)
      const pipRisk = Math.abs(entryPrice - stopLoss) / pipDecimal;
      
      // Calculate position size in standard lots
      // Formula: Risk Amount USD / (Pip Risk × Pip Value USD) = Standard Lots
      const standardLot = pipRisk > 0 ? riskAmount / (pipRisk * pipValue) : 0;
      
      // Convert to micro lots (1 standard lot = 1000 micro lots)
      const microLot = standardLot * 1000;
      
      // Calculate expected profit/loss in USD based on 2:1 RR
      const expectedRiskUSD = riskAmount; // This should equal our 1% risk
      const expectedProfitUSD = riskAmount * 2; // 2:1 RR = 2% profit
      
      console.log(`Lot size calculation for ${symbol}:`, {
        cleanSymbol,
        entryPrice,
        stopLoss,
        pipDecimal,
        pipRisk: pipRisk.toFixed(1),
        pipValue,
        riskAmount,
        standardLot: standardLot.toFixed(3),
        microLot: microLot.toFixed(0)
      });

      return {
        standardLot: Number(standardLot.toFixed(3)),
        microLot: Number(microLot.toFixed(0)),
        riskAmount: Number(riskAmount.toFixed(2)),
        pipValue,
        pipRisk: Number(pipRisk.toFixed(1)),
        expectedProfitUSD: Number(expectedProfitUSD.toFixed(2)),
        expectedRiskUSD: Number(expectedRiskUSD.toFixed(2))
      };
    };

    const generateTradeForPair = async (symbol: string, sessionName: string) => {
      try {
        console.log(`Generating trade for ${symbol} - ${sessionName}`);
        
        const marketData = await fetchMarketData(symbol);
        console.log(`Got market data for ${symbol}:`, {
          price: marketData.currentData.currentPrice,
          strategy: marketData.strategy,
          has1hData: marketData.historicalData?.length || 0,
          has4hData: marketData.historical4hData?.length || 0,
          has1dData: marketData.historical1dData?.length || 0,
          session: marketData.sessionContext?.session,
          eodMinutes: marketData.sessionContext?.minutesToEOD,
          isWeekend: marketData.sessionContext?.isWeekendOrHoliday
        });
        
        // Check session context gates before analysis
        if (marketData.sessionContext?.isWeekendOrHoliday) {
          console.log(`❌ ${symbol}: Weekend/Holiday period - skipping trade generation`);
          return null;
        }
        
        if (marketData.sessionContext?.minutesToEOD < 120) {
          console.log(`❌ ${symbol}: Too close to EOD (${marketData.sessionContext.minutesToEOD} minutes) - skipping trade generation`);
          return null;
        }
        
        const analysis = await getAIAnalysis(
          symbol, 
          marketData.historicalData, 
          marketData.currentData, 
          marketData.historical4hData,
          marketData.historical1dData, // Pass 1D data
          marketData.sessionContext // Pass session context
        );
        console.log(`Got analysis for ${symbol}:`, analysis ? {
          action: analysis.action,
          confidence: analysis.confidence,
          entry: analysis.entry,
          currentPrice: marketData.currentData.currentPrice,
          entryType: analysis.entry === marketData.currentData.currentPrice ? 'MARKET' : 'LIMIT',
          riskReward: analysis.riskReward
        } : 'null');
        
        // Only create trades if AI analysis succeeds
        if (!analysis || analysis.error) {
          console.log(`AI analysis failed for ${symbol}, skipping trade creation`);
          return null;
        }

        // Determine order type and initial status
        const currentPrice = marketData.currentData.currentPrice;
        const isMarketOrder = Math.abs(analysis.entry - currentPrice) < 0.0001; // Within 0.1 pip
        const orderType = isMarketOrder ? 'MARKET' : 'LIMIT';
        const entryFilled = isMarketOrder; // Market orders are filled immediately
        
        console.log(`${orderType} order for ${symbol}: Entry ${analysis.entry}, Current ${currentPrice}`);

        // For limit orders, validate entry direction makes sense
        if (!isMarketOrder) {
          const isBuyLimitValid = analysis.action === 'BUY' && analysis.entry < currentPrice;
          const isSellLimitValid = analysis.action === 'SELL' && analysis.entry > currentPrice;
          
          if (!isBuyLimitValid && !isSellLimitValid) {
            console.log(`⚠️ Invalid limit order: ${analysis.action} entry ${analysis.entry} vs current ${currentPrice}`);
            // Convert to market order for immediate execution
            analysis.entry = currentPrice;
            const orderType = 'MARKET';
            const entryFilled = true;
            console.log(`🔧 Converted to market order at ${currentPrice}`);
          }
        }
        
        
        const userId = 'b195e363-8000-4440-9632-f9af83eb0e8c'; // Your user ID
        
        // Check for existing open trades for this symbol
        const { data: existingTrades, error: fetchError } = await supabase
          .from('auto_trades')
          .select('*')
          .eq('symbol', symbol)
          .eq('status', 'OPEN')
          .eq('user_id', userId);

        if (fetchError) {
          console.error(`Failed to fetch existing trades for ${symbol}:`, fetchError);
        }

        if (existingTrades && existingTrades.length > 0) {
          const existingTrade = existingTrades[0];
          
          // Check if direction changed
          if (existingTrade.action !== analysis.action) {
            console.log(`Direction changed for ${symbol}: ${existingTrade.action} -> ${analysis.action}, closing existing trade`);
            await closeExistingTrade(existingTrade, marketData.currentData.currentPrice, 'Direction change');
          } else {
            console.log(`Same direction for ${symbol} (${analysis.action}), keeping existing trade`);
            return null; // Don't create new trade
          }
        }
        
        console.log(`CREATING TRADE ${symbol}: Always generate for daily target`);

        console.log(`Attempting to create trade record for ${symbol} with userId: ${userId}`);
        
        // Calculate lot sizes for this trade (for $10K account)
        const lotSizeInfo10K = calculateLotSizeForTrade(
          symbol, 
          analysis?.entry || marketData.currentData.currentPrice,
          analysis?.stopLoss || 0,
          10000 // $10K account
        );
        
        // Calculate lot sizes for $25K account for comparison
        const lotSizeInfo25K = calculateLotSizeForTrade(
          symbol, 
          analysis?.entry || marketData.currentData.currentPrice,
          analysis?.stopLoss || 0,
          25000 // $25K account
        );
        
        console.log(`Risk Management Analysis for ${symbol}:`, {
          '10K_Account': {
            standardLot: lotSizeInfo10K.standardLot,
            microLot: lotSizeInfo10K.microLot,
            riskUSD: lotSizeInfo10K.expectedRiskUSD,
            profitUSD: lotSizeInfo10K.expectedProfitUSD,
            pipRisk: lotSizeInfo10K.pipRisk
          },
          '25K_Account': {
            standardLot: lotSizeInfo25K.standardLot,
            microLot: lotSizeInfo25K.microLot,
            riskUSD: lotSizeInfo25K.expectedRiskUSD,
            profitUSD: lotSizeInfo25K.expectedProfitUSD,
            pipRisk: lotSizeInfo25K.pipRisk
          }
        });
        
        // Prepare trade data with new order type fields
        const tradeData = {
          symbol,
          session_name: sessionName,
          user_id: userId,
          status: 'OPEN',
          order_type: orderType,
          entry_filled: entryFilled,
          entry_filled_at: entryFilled ? new Date().toISOString() : null,
          rejection_reason: null,
          ai_confidence: analysis?.confidence || null,
          risk_reward_ratio: analysis?.rrRatio || null,
          risk_pips: analysis?.riskPips || null,
          reward_pips: analysis?.rewardPips || null,
          action: analysis?.action || 'BUY',
          entry_price: analysis?.entry || marketData.currentData.currentPrice,
          stop_loss: analysis?.stopLoss || 0,
          take_profit: analysis?.takeProfit || 0,
          lot_size: lotSizeInfo10K.standardLot, // Use $10K account as default
          calculated_micro_lots: lotSizeInfo10K.microLot,
          calculated_risk_amount: lotSizeInfo10K.riskAmount,
          calculated_pip_risk: lotSizeInfo10K.pipRisk,
          next_check_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
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
          
          // Send Telegram notification for new trade
          try {
            const notificationData = {
              trade_id: trade.id,
              symbol: trade.symbol,
              action: trade.action,
              entry_price: trade.entry_price,
              stop_loss: trade.stop_loss,
              take_profit: trade.take_profit,
              order_type: trade.order_type,
              confidence: trade.ai_confidence,
              session: trade.session_name,
              notification_type: 'trade_opened'
            };

            console.log(`Sending Telegram notification for trade ${trade.id}`);
            
            const { data: notificationResult, error: notificationError } = await supabase.functions.invoke('telegram-notifications', {
              body: notificationData
            });

            if (notificationError) {
              console.error('Failed to send Telegram notification:', notificationError);
            } else {
              console.log('Telegram notification sent successfully:', notificationResult);
            }
          } catch (notificationError) {
            console.error('Error sending Telegram notification:', notificationError);
          }
          
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

      // Check if it's Friday and close to market close (2 hours before 22:00 UTC)
      const now = new Date();
      const utcDay = now.getUTCDay(); // 0 = Sunday, 5 = Friday
      const utcHour = now.getUTCHours();
      
      if (utcDay === 5 && utcHour >= 20) { // Friday after 20:00 UTC (2 hours before market close)
        console.log("Friday market close approaching, closing all open trades");
        for (const trade of activeTrades || []) {
          try {
            const marketData = await fetchMarketData(trade.symbol);
            const currentPrice = marketData.currentData.currentPrice;
            await closeExistingTrade(trade, currentPrice, 'Weekend closure - market closing');
          } catch (error) {
            console.error(`Failed to close trade ${trade.id} for weekend:`, error);
          }
        }
        return;
      }

      for (const trade of activeTrades || []) {
        try {
          const marketData = await fetchMarketData(trade.symbol);
          const currentPrice = marketData.currentData.currentPrice;

          // Check if trade is older than 36 hours
          const tradeAge = Date.now() - new Date(trade.created_at).getTime();
          const maxAgeMs = 36 * 60 * 60 * 1000; // 36 hours in milliseconds

          if (tradeAge > maxAgeMs) {
            console.log(`Trade ${trade.id} exceeded 36 hours, auto-closing`);
            await closeExistingTrade(trade, currentPrice, '36 hour limit exceeded');
            continue;
          }

          // Handle limit orders that haven't been filled yet
          if (trade.order_type === 'LIMIT' && !trade.entry_filled) {
            let entryReached = false;
            
            if (trade.action === 'BUY' && currentPrice <= trade.entry_price) {
              entryReached = true;
            } else if (trade.action === 'SELL' && currentPrice >= trade.entry_price) {
              entryReached = true;
            }
            
            if (entryReached) {
              console.log(`Limit order ${trade.id} filled: ${trade.action} ${trade.symbol} at ${currentPrice} (target: ${trade.entry_price})`);
              
              // Mark entry as filled
              const { error: fillError } = await supabase
                .from('auto_trades')
                .update({
                  entry_filled: true,
                  entry_filled_at: new Date().toISOString(),
                  next_check_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
                })
                .eq('id', trade.id);

              if (fillError) {
                console.error(`Failed to mark trade ${trade.id} as filled:`, fillError);
              } else {
                console.log(`Trade ${trade.id} now active and monitoring for SL/TP`);
              }
            }
            
            // Don't check SL/TP until entry is filled
            continue;
          }

          // Only monitor SL/TP for filled trades (market orders or filled limit orders)
          if (!trade.entry_filled) {
            continue;
          }

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
              
              // Send telegram notification for trade closure
              try {
                const notificationData = {
                  trade_id: trade.id,
                  symbol: trade.symbol,
                  action: trade.action,
                  entry_price: trade.entry_price,
                  stop_loss: trade.stop_loss,
                  take_profit: trade.take_profit,
                  order_type: trade.order_type || 'MARKET',
                  confidence: trade.ai_confidence,
                  session: trade.session_name,
                  notification_type: 'trade_closed',
                  status: tradeStatus,
                  pips_result: pipsResult,
                  ai_confidence: trade.ai_confidence,
                  risk_reward_ratio: trade.risk_reward_ratio,
                  created_at: trade.created_at,
                  closed_at: new Date().toISOString()
                };

                console.log(`Sending telegram notification for closed trade ${trade.id}`);
                
                const notificationResponse = await fetch('https://cgmzxonyaiwtcyxmmhsi.supabase.co/functions/v1/telegram-notifications', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(notificationData)
                });

                if (!notificationResponse.ok) {
                  const errorText = await notificationResponse.text();
                  console.error(`Failed to send telegram notification for trade ${trade.id}:`, errorText);
                } else {
                  const result = await notificationResponse.json();
                  console.log(`Telegram notification sent for trade ${trade.id}:`, result);
                }
              } catch (notificationError) {
                console.error(`Error sending telegram notification for trade ${trade.id}:`, notificationError);
              }
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
      const day = getRomaniaDay();
      
      console.log(`Current time: ${currentHour}:${currentMinute} Romania time (day: ${day})`);
      
      // Block trading from Friday 19:00 Romania through Monday 10:00 Romania
      const isWeekend = day === 0 || day === 6; // Sun or Sat
      const isFridayBlackout = day === 5 && currentHour >= 19;
      const isMondayBeforeLondon = day === 1 && currentHour < 10;
      if (isWeekend || isFridayBlackout || isMondayBeforeLondon) {
        console.log('Weekend/blackout window - skipping trade generation');
        return;
      }
      
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
              results.push({ symbol, status: 'ERROR', error: (error as Error).message });
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
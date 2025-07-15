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
    pairs: ['GBP/JPY'],
    startHour: 2,
  },
  {
    name: 'London Session',
    pairs: ['GBP/USD', 'GBP/JPY'],
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      const response = await fetch(
        `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1h&apikey=${twelveApiKey}&outputsize=100`
      );
      const data = await response.json();
      
      if (!data.values || data.values.length === 0) {
        throw new Error(`No market data for ${symbol}`);
      }

      const latest = data.values[0];
      return {
        historicalData: data.values,
        currentData: {
          price: parseFloat(latest.close),
          timestamp: latest.datetime
        }
      };
    };

    const getAIAnalysis = async (symbol: string, historicalData: any[], currentData: any) => {
      const prompt = `Analyze ${symbol} forex pair for trading opportunity.

Historical data (last 20 periods):
${historicalData.slice(0, 20).map(d => `${d.datetime}: O=${d.open} H=${d.high} L=${d.low} C=${d.close}`).join('\n')}

Current price: ${currentData.price}

Provide analysis with MINIMUM 1:1.5 risk/reward ratio:
- Action: BUY or SELL
- Entry price
- Stop loss 
- Take profit
- Confidence (1-10)
- Brief reasoning

Format: {"action": "BUY/SELL", "entry": number, "stopLoss": number, "takeProfit": number, "confidence": number, "reasoning": "text"}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are an expert forex analyst. Always ensure risk/reward ratio is at least 1:1.5. Return only valid JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
        }),
      });

      const aiData = await response.json();
      const aiResponse = aiData.choices[0].message.content;
      
      try {
        const analysis = JSON.parse(aiResponse);
        
        // Validate minimum R/R ratio
        const riskPoints = Math.abs(analysis.entry - analysis.stopLoss);
        const rewardPoints = Math.abs(analysis.takeProfit - analysis.entry);
        const rrRatio = rewardPoints / riskPoints;
        
        if (rrRatio < 1.5) {
          console.log(`Rejecting ${symbol} trade: R/R ratio ${rrRatio.toFixed(2)} is below 1:1.5 minimum`);
          return null;
        }
        
        return analysis;
      } catch (error) {
        console.error('Failed to parse AI response:', aiResponse);
        return null;
      }
    };

    const generateTradeForPair = async (symbol: string, sessionName: string) => {
      try {
        console.log(`Generating trade for ${symbol} - ${sessionName}`);
        
        const marketData = await fetchMarketData(symbol);
        console.log(`Got market data for ${symbol}`);
        
        const analysis = await getAIAnalysis(symbol, marketData.historicalData, marketData.currentData);
        console.log(`Got analysis for ${symbol}:`, analysis);
        
        if (!analysis || analysis.confidence < 6) {
          console.log(`Skipping ${symbol}: Low confidence or invalid analysis`);
          return null;
        }

        // For now, create trades for the authenticated user making the request
        // In production, you might want to get all users who have auto-trading enabled
        const authHeader = Deno.env.get('_SUPABASE_AUTH');
        let userId = 'b195e363-8000-4440-9632-f9af83eb0e8c'; // Your user ID as fallback
        
        if (authHeader) {
          try {
            const payload = JSON.parse(atob(authHeader.split(' ')[1].split('.')[1]));
            userId = payload.sub;
            console.log(`Using authenticated user: ${userId}`);
          } catch (e) {
            console.log('Could not parse auth header, using fallback user ID');
          }
        }

        const nextCheck = new Date();
        nextCheck.setHours(nextCheck.getHours() + 3);

        const { data: trade, error } = await supabase
          .from('auto_trades')
          .insert({
            symbol,
            action: analysis.action,
            entry_price: analysis.entry,
            stop_loss: analysis.stopLoss,
            take_profit: analysis.takeProfit,
            session_name: sessionName,
            next_check_at: nextCheck.toISOString(),
            user_id: userId
          })
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
          const currentPrice = marketData.currentData.price;

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
      
      // For testing: force generation of New York session trades
      const testBody = await req.json();
      if (testBody?.time === 'manual_test') {
        console.log('Manual test mode - generating New York session trades');
        const testSession = SESSION_CONFIGS.find(s => s.name === 'New York Session');
        if (testSession) {
          console.log(`Generating test trades for ${testSession.name}`);
          for (const symbol of testSession.pairs) {
            await generateTradeForPair(symbol, testSession.name);
          }
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
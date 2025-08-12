import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MT5TradeData {
  id: string;
  symbol: string;
  action: string; // BUY or SELL
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  lot_size: number;
  operation: string; // OPEN, CLOSE, MODIFY
  status: string;
  user_id: string;
  created_at: string;
  pips_result?: number;
  closed_at?: string;
}

interface MT5Command {
  command: string;
  trade_id: string;
  symbol: string;
  action?: string;
  volume?: number;
  price?: number;
  sl?: number;
  tp?: number;
  comment?: string;
}

serve(async (req) => {
  console.log('MT5 Sync function called with method:', req.method);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const tradeData: MT5TradeData = await req.json();
    console.log('Received trade data:', JSON.stringify(tradeData, null, 2));

    // Convert trade data to MT5 command format
    const mt5Command = convertToMT5Command(tradeData);
    console.log('Generated MT5 command:', JSON.stringify(mt5Command, null, 2));

    // Get MT5 webhook URL from environment or user settings
    // For now, we'll log the command and return success
    // In production, this would send to your MT5 expert advisor
    const mt5WebhookUrl = Deno.env.get('MT5_WEBHOOK_URL');
    
    if (mt5WebhookUrl) {
      console.log(`Sending command to MT5 at: ${mt5WebhookUrl}`);
      
      try {
        const response = await fetch(mt5WebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mt5Command),
        });

        if (!response.ok) {
          throw new Error(`MT5 API error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log('MT5 response:', result);

        return new Response(JSON.stringify({
          success: true,
          message: 'Trade synchronized with MT5',
          mt5_response: result,
          command: mt5Command
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (mt5Error) {
        console.error('Error communicating with MT5:', mt5Error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to communicate with MT5',
          details: mt5Error.message,
          command: mt5Command
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.log('No MT5 webhook URL configured, logging command only');
      
      return new Response(JSON.stringify({
        success: true,
        message: 'MT5 command generated (no webhook URL configured)',
        command: mt5Command,
        note: 'Configure MT5_WEBHOOK_URL environment variable to enable actual MT5 communication'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in MT5 sync function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to process trade data',
      details: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function convertToMT5Command(tradeData: MT5TradeData): MT5Command {
  const baseCommand: MT5Command = {
    command: tradeData.operation,
    trade_id: tradeData.id,
    symbol: tradeData.symbol,
    comment: `Auto-trade ${tradeData.operation} - ${new Date().toISOString()}`
  };

  switch (tradeData.operation) {
    case 'OPEN':
      return {
        ...baseCommand,
        command: 'OPEN_TRADE',
        action: tradeData.action, // BUY or SELL
        volume: tradeData.lot_size,
        price: tradeData.entry_price,
        sl: tradeData.stop_loss,
        tp: tradeData.take_profit
      };

    case 'CLOSE':
      return {
        ...baseCommand,
        command: 'CLOSE_TRADE',
        price: tradeData.entry_price // Use entry price as reference for close
      };

    case 'MODIFY':
      return {
        ...baseCommand,
        command: 'MODIFY_TRADE',
        sl: tradeData.stop_loss,
        tp: tradeData.take_profit
      };

    default:
      return baseCommand;
  }
}
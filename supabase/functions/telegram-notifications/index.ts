import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TradeNotification {
  trade_id: string;
  symbol: string;
  action: string;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  order_type?: string;
  confidence?: number;
  session: string;
  notification_type: string;
  status?: string;
  pips_result?: number;
  ai_confidence?: number;
  risk_reward_ratio?: number;
  created_at?: string;
  closed_at?: string;
}

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function sendTelegramMessage(chatId: number, text: string, parseMode = 'HTML') {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: parseMode,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send Telegram message:', errorText);
      return { success: false, error: errorText };
    }

    const result = await response.json();
    return { success: true, messageId: result.result.message_id };
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return { success: false, error: error.message };
  }
}

async function formatTradeOpenMessage(trade: TradeNotification): Promise<string> {
  const confidence = trade.confidence || trade.ai_confidence || 0;
  const confidenceEmoji = confidence > 0.8 ? '🔥' : '📊';
  const actionEmoji = trade.action === 'BUY' ? '🟢' : '🔴';
  const orderTypeEmoji = trade.order_type === 'LIMIT' ? '⏳' : '⚡';
  
  // Calculate lot sizes for different accounts
  let lotSizeInfo = '';
  try {
    const lotCalculationResponse = await fetch(`${SUPABASE_URL}/functions/v1/lot-size-calculator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        symbol: trade.symbol,
        entryPrice: trade.entry_price,
        stopLoss: trade.stop_loss,
        riskPercentage: 1,
        leverage: 100
      }),
    });

    if (lotCalculationResponse.ok) {
      const lotData = await lotCalculationResponse.json();
      lotSizeInfo = `\n📊 <b>POSITION SIZING (1% Risk, 1:100 Leverage):</b>\n` +
        `💼 ${lotData.calculations.account10k.accountSize}: <b>${lotData.calculations.account10k.standardLot} lots</b> (${lotData.calculations.account10k.microLot} micro)\n` +
        `💼 ${lotData.calculations.account25k.accountSize}: <b>${lotData.calculations.account25k.standardLot} lots</b> (${lotData.calculations.account25k.microLot} micro)\n` +
        `💵 Risk: $${lotData.calculations.account10k.riskAmount} / $${lotData.calculations.account25k.riskAmount}\n` +
        `📏 Pip Risk: ${lotData.calculations.account10k.pipRisk} pips\n`;
    }
  } catch (error) {
    console.error('Error calculating lot sizes:', error);
    lotSizeInfo = '\n⚠️ <i>Lot size calculation unavailable</i>\n';
  }
  
  return `${confidenceEmoji} <b>NEW TRADE SIGNAL</b> ${actionEmoji} ${orderTypeEmoji}\n\n` +
    `💱 <b>Pair:</b> ${trade.symbol}\n` +
    `📈 <b>Action:</b> ${trade.action}\n` +
    `💰 <b>Entry:</b> ${trade.entry_price}\n` +
    `🛑 <b>Stop Loss:</b> ${trade.stop_loss}\n` +
    `🎯 <b>Take Profit:</b> ${trade.take_profit}\n` +
    `${orderTypeEmoji} <b>Order Type:</b> ${trade.order_type || 'MARKET'}\n` +
    `⏰ <b>Session:</b> ${trade.session}\n` +
    `🎲 <b>Confidence:</b> ${confidence > 0 ? (confidence * 100).toFixed(1) + '%' : 'N/A'}\n` +
    `📊 <b>Risk/Reward:</b> ${trade.risk_reward_ratio ? `1:${trade.risk_reward_ratio.toFixed(2)}` : 'N/A'}` +
    lotSizeInfo +
    `\n🚀 Trade opened at ${new Date().toLocaleString()}`;
}

function formatTradeCloseMessage(trade: TradeNotification): string {
  const resultEmoji = trade.pips_result && trade.pips_result > 0 ? '✅' : '❌';
  const pipsText = trade.pips_result ? `${trade.pips_result > 0 ? '+' : ''}${trade.pips_result.toFixed(1)} pips` : 'N/A';
  
  return `${resultEmoji} <b>TRADE CLOSED</b>\n\n` +
    `💱 <b>Pair:</b> ${trade.symbol}\n` +
    `📈 <b>Action:</b> ${trade.action}\n` +
    `💰 <b>Entry:</b> ${trade.entry_price}\n` +
    `📊 <b>Result:</b> ${pipsText}\n` +
    `⏰ <b>Session:</b> ${trade.session}\n` +
    `🕐 <b>Duration:</b> ${calculateTradeDuration(trade.created_at || '', trade.closed_at)}\n\n` +
    `${trade.pips_result && trade.pips_result > 0 ? '🎉 Profitable trade!' : '💪 Better luck next time!'}`;
}

function calculateTradeDuration(openTime: string, closeTime?: string): string {
  if (!closeTime) return 'N/A';
  
  const start = new Date(openTime);
  const end = new Date(closeTime);
  const diffMs = end.getTime() - start.getTime();
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

async function getSubscribersForPair(symbol: string): Promise<number[]> {
  const { data: subscribers, error } = await supabase
    .from('telegram_subscribers')
    .select('chat_id, subscribed_pairs')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching subscribers:', error);
    return [];
  }

  const normalize = (s: string) => s.replace(/[^A-Za-z]/g, '').toUpperCase();
  const target = normalize(symbol);

  const chatIds = (subscribers || [])
    .filter((sub: any) => {
      const pairs: string[] = Array.isArray(sub.subscribed_pairs) ? sub.subscribed_pairs : [];
      if (pairs.length === 0) return true; // Empty or null means all pairs
      return pairs.some((p) => normalize(p) === target);
    })
    .map((sub: any) => sub.chat_id);

  console.log(`Matched ${chatIds.length}/${subscribers?.length ?? 0} subscribers for ${symbol} (norm: ${target})`);
  return chatIds;
}

async function logNotification(
  chatId: number, 
  tradeId: string, 
  messageText: string, 
  notificationType: string,
  success: boolean,
  messageId?: number,
  error?: string
) {
  await supabase
    .from('telegram_notifications')
    .insert({
      chat_id: chatId,
      trade_id: tradeId,
      message_text: messageText,
      notification_type: notificationType,
      telegram_message_id: messageId,
      success: success,
      error_message: error,
    });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN environment variable is not set');
    }

    const notification: TradeNotification = await req.json();
    console.log('Received trade notification:', JSON.stringify(notification, null, 2));

    const { trade_id, symbol, notification_type } = notification;
    
    // Get subscribers for this pair
    const subscriberChatIds = await getSubscribersForPair(symbol);
    
    if (subscriberChatIds.length === 0) {
      console.log(`No active subscribers for ${symbol}`);
      return new Response(
        JSON.stringify({ success: true, message: 'No subscribers to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format message based on notification_type
    let message: string;
    let logNotificationType: string;

    if (notification_type === 'trade_opened') {
      message = await formatTradeOpenMessage(notification);
      logNotificationType = 'TRADE_OPEN';
    } else if (notification_type === 'trade_closed') {
      message = formatTradeCloseMessage(notification);
      logNotificationType = 'TRADE_CLOSE';
    } else {
      message = await formatTradeOpenMessage(notification); // Default to open format
      logNotificationType = 'TRADE_UPDATE';
    }

    // Send notifications to all subscribers
    const results = await Promise.allSettled(
      subscriberChatIds.map(async (chatId) => {
        const result = await sendTelegramMessage(chatId, message);
        
        // Log the notification
        await logNotification(
          chatId,
          trade_id,
          message,
          logNotificationType,
          result.success,
          result.messageId,
          result.error
        );

        return { chatId, success: result.success, error: result.error };
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    console.log(`Notification sent - Success: ${successful}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successful, 
        failed: failed,
        total: subscriberChatIds.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in telegram-notifications function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
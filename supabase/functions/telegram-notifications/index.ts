import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TradeNotification {
  tradeId: string;
  symbol: string;
  action: string;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  session_name: string;
  status: string;
  pips_result?: number;
  ai_confidence?: number;
  risk_reward_ratio?: number;
  created_at: string;
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

function formatTradeOpenMessage(trade: TradeNotification): string {
  const confidenceEmoji = trade.ai_confidence && trade.ai_confidence > 0.8 ? '🔥' : '📊';
  const actionEmoji = trade.action === 'BUY' ? '🟢' : '🔴';
  
  return `${confidenceEmoji} <b>NEW TRADE SIGNAL</b> ${actionEmoji}\n\n` +
    `💱 <b>Pair:</b> ${trade.symbol}\n` +
    `📈 <b>Action:</b> ${trade.action}\n` +
    `💰 <b>Entry:</b> ${trade.entry_price}\n` +
    `🛑 <b>Stop Loss:</b> ${trade.stop_loss}\n` +
    `🎯 <b>Take Profit:</b> ${trade.take_profit}\n` +
    `⏰ <b>Session:</b> ${trade.session_name}\n` +
    `🎲 <b>Confidence:</b> ${trade.ai_confidence ? (trade.ai_confidence * 100).toFixed(1) + '%' : 'N/A'}\n` +
    `📊 <b>Risk/Reward:</b> ${trade.risk_reward_ratio ? `1:${trade.risk_reward_ratio.toFixed(2)}` : 'N/A'}\n\n` +
    `🚀 Trade opened at ${new Date(trade.created_at).toLocaleString()}`;
}

function formatTradeCloseMessage(trade: TradeNotification): string {
  const resultEmoji = trade.pips_result && trade.pips_result > 0 ? '✅' : '❌';
  const pipsText = trade.pips_result ? `${trade.pips_result > 0 ? '+' : ''}${trade.pips_result.toFixed(1)} pips` : 'N/A';
  
  return `${resultEmoji} <b>TRADE CLOSED</b>\n\n` +
    `💱 <b>Pair:</b> ${trade.symbol}\n` +
    `📈 <b>Action:</b> ${trade.action}\n` +
    `💰 <b>Entry:</b> ${trade.entry_price}\n` +
    `📊 <b>Result:</b> ${pipsText}\n` +
    `⏰ <b>Session:</b> ${trade.session_name}\n` +
    `🕐 <b>Duration:</b> ${calculateTradeDuration(trade.created_at, trade.closed_at)}\n\n` +
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

  return subscribers
    .filter(sub => 
      sub.subscribed_pairs.length === 0 || // Empty array means all pairs
      sub.subscribed_pairs.includes(symbol)
    )
    .map(sub => sub.chat_id);
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

    const { tradeId, symbol, status } = notification;
    
    // Get subscribers for this pair
    const subscriberChatIds = await getSubscribersForPair(symbol);
    
    if (subscriberChatIds.length === 0) {
      console.log(`No active subscribers for ${symbol}`);
      return new Response(
        JSON.stringify({ success: true, message: 'No subscribers to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format message based on status
    let message: string;
    let notificationType: string;

    if (status === 'OPEN') {
      message = formatTradeOpenMessage(notification);
      notificationType = 'TRADE_OPEN';
    } else if (status === 'CLOSED') {
      message = formatTradeCloseMessage(notification);
      notificationType = 'TRADE_CLOSE';
    } else {
      message = formatTradeOpenMessage(notification); // Default to open format
      notificationType = 'TRADE_UPDATE';
    }

    // Send notifications to all subscribers
    const results = await Promise.allSettled(
      subscriberChatIds.map(async (chatId) => {
        const result = await sendTelegramMessage(chatId, message);
        
        // Log the notification
        await logNotification(
          chatId,
          tradeId,
          message,
          notificationType,
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
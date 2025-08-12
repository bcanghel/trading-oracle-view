import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
}

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

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

    const result = await response.json();
    console.log('Telegram API response:', result);
    
    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description}`);
    }
    
    return result.result;
  } catch (error) {
    console.error('Error sending telegram message:', error);
    throw error;
  }
}

async function handleStartCommand(chatId: number, firstName: string, username?: string) {
  const welcomeMessage = `
🤖 <b>Welcome to Oracle AI Auto Trader!</b>

Hello ${firstName}! I'm your trading signal bot. Here's what I can do:

📊 <b>Features:</b>
• Get real-time trading signals
• Receive notifications when trades open/close
• Subscribe to specific currency pairs
• View your trading performance

🔧 <b>Commands:</b>
/start - Show this welcome message
/subscribe - Subscribe to all trading signals
/unsubscribe - Unsubscribe from all signals  
/pairs - Manage currency pair subscriptions
/status - Check your subscription status
/help - Show detailed help

💡 <b>Getting Started:</b>
Send /subscribe to start receiving trading signals!

⚠️ <b>Disclaimer:</b> Trading involves risk. Always do your own research and never invest more than you can afford to lose.
`;

  // Save subscriber to database
  const { error } = await supabase
    .from('telegram_subscribers')
    .upsert({
      chat_id: chatId,
      username: username,
      first_name: firstName,
      is_active: false, // Not active until they subscribe
      subscribed_pairs: []
    }, {
      onConflict: 'chat_id'
    });

  if (error) {
    console.error('Error saving subscriber:', error);
  }

  await sendTelegramMessage(chatId, welcomeMessage);
}

async function handleSubscribeCommand(chatId: number) {
  const { error } = await supabase
    .from('telegram_subscribers')
    .update({ 
      is_active: true,
      subscribed_pairs: [] // Empty array means all pairs
    })
    .eq('chat_id', chatId);

  if (error) {
    console.error('Error updating subscription:', error);
    await sendTelegramMessage(chatId, '❌ Error updating subscription. Please try again.');
    return;
  }

  const message = `
✅ <b>Successfully Subscribed!</b>

You will now receive:
• Trade open notifications
• Trade close notifications
• Performance updates

You're subscribed to <b>ALL currency pairs</b>.
Use /pairs to customize which pairs you want to follow.

Happy trading! 📈
`;

  await sendTelegramMessage(chatId, message);
}

async function handleUnsubscribeCommand(chatId: number) {
  const { error } = await supabase
    .from('telegram_subscribers')
    .update({ is_active: false })
    .eq('chat_id', chatId);

  if (error) {
    console.error('Error updating subscription:', error);
    await sendTelegramMessage(chatId, '❌ Error updating subscription. Please try again.');
    return;
  }

  const message = `
🔕 <b>Unsubscribed Successfully</b>

You will no longer receive trading notifications.

To resubscribe anytime, just send /subscribe.

Thank you for using Oracle AI Auto Trader! 
`;

  await sendTelegramMessage(chatId, message);
}

async function handleStatusCommand(chatId: number) {
  const { data: subscriber, error } = await supabase
    .from('telegram_subscribers')
    .select('*')
    .eq('chat_id', chatId)
    .single();

  if (error || !subscriber) {
    await sendTelegramMessage(chatId, '❌ You are not registered. Send /start to begin.');
    return;
  }

  const status = subscriber.is_active ? '✅ Active' : '🔕 Inactive';
  const pairs = subscriber.subscribed_pairs.length === 0 
    ? 'All currency pairs' 
    : subscriber.subscribed_pairs.join(', ');

  const message = `
📊 <b>Your Subscription Status</b>

<b>Status:</b> ${status}
<b>Following:</b> ${pairs}
<b>Member since:</b> ${new Date(subscriber.created_at).toLocaleDateString()}

${subscriber.is_active ? '' : '\nSend /subscribe to activate notifications.'}
`;

  await sendTelegramMessage(chatId, message);
}

async function handlePairsCommand(chatId: number) {
  const availablePairs = [
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 
    'AUD/USD', 'USD/CAD', 'NZD/USD', 'EUR/GBP', 
    'EUR/JPY', 'GBP/JPY'
  ];

  const message = `
📈 <b>Currency Pairs Management</b>

Available pairs:
${availablePairs.map(pair => `• ${pair}`).join('\n')}

<b>Current setting:</b> You're following ALL pairs

<i>Advanced pair selection coming soon! For now, you receive signals for all major pairs.</i>

Use /subscribe to ensure you're getting all signals.
`;

  await sendTelegramMessage(chatId, message);
}

async function handleHelpCommand(chatId: number) {
  const message = `
🆘 <b>Oracle AI Auto Trader - Help</b>

<b>📊 About:</b>
This bot provides automated forex trading signals using AI analysis. Signals are generated based on technical analysis, market sessions, and AI recommendations.

<b>🔧 Commands:</b>
/start - Welcome message and registration
/subscribe - Start receiving trading signals
/unsubscribe - Stop receiving signals
/pairs - Manage currency pair subscriptions
/status - Check your subscription status
/help - Show this help message

<b>📈 Signal Types:</b>
• <b>Trade Open:</b> When a new position opens
• <b>Trade Close:</b> When a position closes with results
• <b>Updates:</b> Important trade modifications

<b>📊 Signal Information Includes:</b>
• Currency pair (e.g., EUR/USD)
• Action (BUY/SELL)
• Entry price
• Stop loss and take profit levels
• AI confidence level
• Session information

<b>⚠️ Important:</b>
• Signals are for educational purposes
• Always do your own research
• Never risk more than you can afford to lose
• Past performance doesn't guarantee future results

<b>🐛 Issues?</b>
If you experience any problems, try /start to refresh your registration.

Happy trading! 🚀
`;

  await sendTelegramMessage(chatId, message);
}

async function processMessage(update: TelegramUpdate) {
  if (!update.message) return;

  const { message } = update;
  const chatId = message.chat.id;
  const text = message.text || '';
  const firstName = message.from.first_name;
  const username = message.from.username;

  console.log(`Received message from ${firstName} (${chatId}): ${text}`);

  try {
    if (text.startsWith('/start')) {
      await handleStartCommand(chatId, firstName, username);
    } else if (text.startsWith('/subscribe')) {
      await handleSubscribeCommand(chatId);
    } else if (text.startsWith('/unsubscribe')) {
      await handleUnsubscribeCommand(chatId);
    } else if (text.startsWith('/status')) {
      await handleStatusCommand(chatId);
    } else if (text.startsWith('/pairs')) {
      await handlePairsCommand(chatId);
    } else if (text.startsWith('/help')) {
      await handleHelpCommand(chatId);
    } else {
      // Default response for unknown commands
      await sendTelegramMessage(chatId, `
🤖 I didn't understand that command.

Send /help to see available commands or /start to begin.
`);
    }
  } catch (error) {
    console.error('Error processing message:', error);
    await sendTelegramMessage(chatId, '❌ Sorry, something went wrong. Please try again.');
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === 'POST') {
      // Handle Telegram webhook
      const update: TelegramUpdate = await req.json();
      console.log('Received update:', update);
      
      await processMessage(update);
      
      return new Response('OK', { 
        status: 200,
        headers: corsHeaders 
      });
    } else if (req.method === 'GET') {
      // Health check endpoint
      return new Response(JSON.stringify({ 
        status: 'active',
        bot_token_configured: !!TELEGRAM_BOT_TOKEN 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      return new Response('Method not allowed', { 
        status: 405,
        headers: corsHeaders 
      });
    }
  } catch (error) {
    console.error('Error in telegram-bot function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      first_name: string;
      username?: string;
      type: string;
    };
    date: number;
    text: string;
  };
}

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function sendTelegramMessage(chatId: number, text: string, parseMode = 'HTML') {
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
    console.error('Failed to send Telegram message:', await response.text());
    return null;
  }

  return await response.json();
}

async function handleStartCommand(chatId: number, firstName: string, username?: string) {
  // Check if user is already subscribed
  const { data: existingSubscriber } = await supabase
    .from('telegram_subscribers')
    .select('*')
    .eq('chat_id', chatId)
    .single();

  if (existingSubscriber) {
    await sendTelegramMessage(chatId, 
      `Welcome back, ${firstName}! 🤖\n\n` +
      `You're already subscribed to trading signals. Use /status to see your current settings.`
    );
    return;
  }

  // Create new subscriber
  const { error } = await supabase
    .from('telegram_subscribers')
    .insert({
      chat_id: chatId,
      username: username,
      first_name: firstName,
      is_active: true,
      subscribed_pairs: [], // Empty array means all pairs
    });

  if (error) {
    console.error('Error creating subscriber:', error);
    await sendTelegramMessage(chatId, 
      'Sorry, there was an error setting up your subscription. Please try again later.'
    );
    return;
  }

  await sendTelegramMessage(chatId, 
    `🎉 Welcome to Oracle AI Auto Trader, ${firstName}!\n\n` +
    `You're now subscribed to receive trading signals for all currency pairs.\n\n` +
    `<b>Available Commands:</b>\n` +
    `/status - View your subscription status\n` +
    `/pairs - Subscribe to specific pairs\n` +
    `/all - Subscribe to all pairs\n` +
    `/stop - Unsubscribe from all signals\n` +
    `/help - Show this help message\n\n` +
    `🚀 You'll receive notifications when trades are opened and closed!`
  );
}

async function handleStatusCommand(chatId: number) {
  const { data: subscriber } = await supabase
    .from('telegram_subscribers')
    .select('*')
    .eq('chat_id', chatId)
    .single();

  if (!subscriber) {
    await sendTelegramMessage(chatId, 
      'You are not subscribed yet. Send /start to subscribe to trading signals.'
    );
    return;
  }

  const pairsText = subscriber.subscribed_pairs.length === 0 
    ? 'All currency pairs' 
    : subscriber.subscribed_pairs.join(', ');

  await sendTelegramMessage(chatId, 
    `📊 <b>Your Subscription Status</b>\n\n` +
    `Status: ${subscriber.is_active ? '✅ Active' : '❌ Inactive'}\n` +
    `Subscribed pairs: ${pairsText}\n` +
    `Subscribed since: ${new Date(subscriber.created_at).toLocaleDateString()}`
  );
}

async function handlePairsCommand(chatId: number, pairs?: string) {
  if (!pairs) {
    await sendTelegramMessage(chatId, 
      `📈 <b>Available Currency Pairs:</b>\n\n` +
      `EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, NZD/USD, EUR/GBP, EUR/JPY, GBP/JPY\n\n` +
      `To subscribe to specific pairs, use:\n` +
      `/pairs EUR/USD,GBP/USD,USD/JPY`
    );
    return;
  }

  const requestedPairs = pairs.split(',').map(p => p.trim().toUpperCase());
  const validPairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY'];
  const filteredPairs = requestedPairs.filter(p => validPairs.includes(p));

  if (filteredPairs.length === 0) {
    await sendTelegramMessage(chatId, 
      'Invalid currency pairs. Please use valid pairs like EUR/USD, GBP/USD, etc.'
    );
    return;
  }

  const { error } = await supabase
    .from('telegram_subscribers')
    .upsert({
      chat_id: chatId,
      subscribed_pairs: filteredPairs,
      is_active: true,
    });

  if (error) {
    console.error('Error updating pairs:', error);
    await sendTelegramMessage(chatId, 'Error updating your subscription. Please try again.');
    return;
  }

  await sendTelegramMessage(chatId, 
    `✅ Successfully subscribed to: ${filteredPairs.join(', ')}\n\n` +
    `You will receive trading signals for these pairs only.`
  );
}

async function handleStopCommand(chatId: number) {
  const { error } = await supabase
    .from('telegram_subscribers')
    .update({ is_active: false })
    .eq('chat_id', chatId);

  if (error) {
    console.error('Error deactivating subscription:', error);
    await sendTelegramMessage(chatId, 'Error updating your subscription. Please try again.');
    return;
  }

  await sendTelegramMessage(chatId, 
    `❌ You have been unsubscribed from trading signals.\n\n` +
    `Send /start anytime to resubscribe.`
  );
}

async function handleAllCommand(chatId: number) {
  const { error } = await supabase
    .from('telegram_subscribers')
    .upsert({
      chat_id: chatId,
      subscribed_pairs: [], // Empty array means all pairs
      is_active: true,
    });

  if (error) {
    console.error('Error subscribing to all pairs:', error);
    await sendTelegramMessage(chatId, 'Error updating your subscription. Please try again.');
    return;
  }

  await sendTelegramMessage(chatId, 
    `✅ Successfully subscribed to ALL currency pairs!\n\n` +
    `You will receive trading signals for all available pairs.`
  );
}

async function handleHelpCommand(chatId: number) {
  await sendTelegramMessage(chatId, 
    `🤖 <b>Oracle AI Auto Trader Bot</b>\n\n` +
    `<b>Available Commands:</b>\n` +
    `/start - Subscribe to trading signals\n` +
    `/status - View your subscription status\n` +
    `/pairs - Subscribe to specific pairs\n` +
    `/all - Subscribe to all pairs\n` +
    `/stop - Unsubscribe from all signals\n` +
    `/help - Show this help message\n\n` +
    `<b>Example:</b>\n` +
    `/pairs EUR/USD,GBP/USD - Subscribe to specific pairs\n\n` +
    `📊 Get real-time notifications when trades are opened and closed!`
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN environment variable is not set');
    }

    const body = await req.json();
    console.log('Received Telegram update:', JSON.stringify(body, null, 2));

    if (!body.message || !body.message.text) {
      return new Response('OK', { headers: corsHeaders });
    }

    const message = body.message;
    const chatId = message.chat.id;
    const text = message.text.trim();
    const firstName = message.from.first_name;
    const username = message.from.username;

    console.log(`Received message from ${firstName}: ${text}`);

    if (text.startsWith('/start')) {
      await handleStartCommand(chatId, firstName, username);
    } else if (text.startsWith('/status')) {
      await handleStatusCommand(chatId);
    } else if (text.startsWith('/pairs')) {
      const pairs = text.replace('/pairs', '').trim();
      await handlePairsCommand(chatId, pairs || undefined);
    } else if (text.startsWith('/all')) {
      await handleAllCommand(chatId);
    } else if (text.startsWith('/stop')) {
      await handleStopCommand(chatId);
    } else if (text.startsWith('/help')) {
      await handleHelpCommand(chatId);
    } else {
      await sendTelegramMessage(chatId, 
        `I don't understand that command. Send /help to see available commands.`
      );
    }

    return new Response('OK', { headers: corsHeaders });
  } catch (error) {
    console.error('Error in telegram-bot function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
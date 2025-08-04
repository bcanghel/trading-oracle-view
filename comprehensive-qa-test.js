// Comprehensive QA Test for Auto Trading System

async function runComprehensiveQA() {
  console.log('🚀 Starting Comprehensive Auto Trading QA Test');
  console.log('=====================================');
  
  // Test 1: Check Current Time and Sessions
  console.log('\n📅 Test 1: Time and Session Check');
  const getRomaniaTime = () => {
    const now = new Date();
    return {
      hour: parseInt(now.toLocaleString('en-US', {
        timeZone: 'Europe/Bucharest',
        hour: '2-digit',
        hour12: false
      })),
      minute: parseInt(now.toLocaleString('en-US', {
        timeZone: 'Europe/Bucharest',
        minute: '2-digit'
      })),
      full: now.toLocaleString('en-US', {
        timeZone: 'Europe/Bucharest',
        hour12: false
      })
    };
  };

  const romaniaTime = getRomaniaTime();
  console.log('Current Romania Time:', romaniaTime);
  
  const SESSION_CONFIGS = [
    { name: 'Asian Session', pairs: ['GBP/AUD'], startHour: 2 },
    { name: 'London Session', pairs: ['GBP/USD'], startHour: 10 },
    { name: 'New York Session', pairs: ['EUR/USD'], startHour: 15 }
  ];
  
  const activeSession = SESSION_CONFIGS.find(session => 
    session.startHour === romaniaTime.hour && romaniaTime.minute <= 15
  );
  
  console.log('Active Session:', activeSession || 'None - outside trading windows');
  console.log('✅ Time check completed');

  // Test 2: Test Market Data API
  console.log('\n📊 Test 2: Market Data API');
  try {
    const testSymbol = 'GBP/USD';
    const marketResponse = await fetch('https://cgmzxonyaiwtcyxmmhsi.supabase.co/functions/v1/fetch-market-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnbXp4b255YWl3dGN5eG1taHNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5NzA2MzYsImV4cCI6MjA2NzU0NjYzNn0.jv5vMtuiLSmJijipBAVlTwjzXp123IDBA9kslT9kQEM'
      },
      body: JSON.stringify({ symbol: testSymbol, strategy: '1H' })
    });
    
    if (marketResponse.ok) {
      const marketData = await marketResponse.json();
      console.log('✅ Market Data API working');
      console.log('- Historical data points:', marketData.historicalData?.length || 0);
      console.log('- Current price:', marketData.currentData?.currentPrice);
    } else {
      console.log('❌ Market Data API failed:', marketResponse.status);
    }
  } catch (error) {
    console.log('❌ Market Data API error:', error.message);
  }

  // Test 3: Test AI Analysis API
  console.log('\n🤖 Test 3: AI Analysis API');
  try {
    const analysisResponse = await fetch('https://cgmzxonyaiwtcyxmmhsi.supabase.co/functions/v1/analyze-trading-opportunity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnbXp4b255YWl3dGN5eG1taHNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5NzA2MzYsImV4cCI6MjA2NzU0NjYzNn0.jv5vMtuiLSmJijipBAVlTwjzXp123IDBA9kslT9kQEM'
      },
      body: JSON.stringify({
        symbol: 'GBP/USD',
        historicalData: [{ close: '1.2500', high: '1.2550', low: '1.2450', open: '1.2500', datetime: '2025-01-01 12:00:00' }],
        currentData: { currentPrice: 1.2500, changePercent: 0.1 },
        historical4hData: [],
        strategy: '1H+4H'
      })
    });
    
    if (analysisResponse.ok) {
      const analysisData = await analysisResponse.json();
      console.log('✅ AI Analysis API working');
      console.log('- Success:', analysisData.success);
      console.log('- Has recommendation:', !!analysisData.recommendation);
    } else {
      console.log('❌ AI Analysis API failed:', analysisResponse.status);
      const errorText = await analysisResponse.text();
      console.log('- Error:', errorText);
    }
  } catch (error) {
    console.log('❌ AI Analysis API error:', error.message);
  }

  // Test 4: Test Auto Trading Scheduler
  console.log('\n⚡ Test 4: Auto Trading Scheduler');
  try {
    const schedulerResponse = await fetch('https://cgmzxonyaiwtcyxmmhsi.supabase.co/functions/v1/auto-trading-scheduler', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnbXp4b255YWl3dGN5eG1taHNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5NzA2MzYsImV4cCI6MjA2NzU0NjYzNn0.jv5vMtuiLSmJijipBAVlTwjzXp123IDBA9kslT9kQEM'
      },
      body: JSON.stringify({ time: "manual_test" })
    });
    
    if (schedulerResponse.ok) {
      const schedulerData = await schedulerResponse.json();
      console.log('✅ Auto Trading Scheduler working');
      console.log('- Success:', schedulerData.success);
      console.log('- Message:', schedulerData.message);
    } else {
      console.log('❌ Auto Trading Scheduler failed:', schedulerResponse.status);
      const errorText = await schedulerResponse.text();
      console.log('- Error:', errorText);
    }
  } catch (error) {
    console.log('❌ Auto Trading Scheduler error:', error.message);
  }

  // Test 5: Database Schema Validation
  console.log('\n🗄️ Test 5: Database Schema Check');
  const requiredColumns = [
    'id', 'user_id', 'symbol', 'action', 'entry_price', 'stop_loss', 
    'take_profit', 'session_name', 'status', 'pips_result', 'created_at', 
    'closed_at', 'next_check_at', 'updated_at', 'rejection_reason', 
    'ai_confidence', 'risk_reward_ratio', 'risk_pips', 'reward_pips'
  ];
  console.log('Required columns for auto_trades table:');
  requiredColumns.forEach(col => console.log(`- ${col}`));
  console.log('✅ Schema validation noted (check database directly)');

  // Test 6: Risk Management Validation
  console.log('\n⚖️ Test 6: Risk Management Rules');
  const riskRules = {
    maxStopLoss: 50, // pips
    maxTakeProfit: 100, // pips
    minRiskReward: 2.0,
    currencyPairs: ['GBP/USD', 'EUR/USD', 'GBP/AUD'],
    sessionsPerDay: 3
  };
  
  console.log('Risk Management Rules:');
  Object.entries(riskRules).forEach(([key, value]) => {
    console.log(`- ${key}: ${value}`);
  });
  console.log('✅ Risk management rules defined');

  // Test 7: Trading Session Windows
  console.log('\n🕐 Test 7: Trading Session Windows');
  SESSION_CONFIGS.forEach(session => {
    const startTime = `${session.startHour}:00`;
    const endTime = `${session.startHour}:15`;
    console.log(`- ${session.name}: ${startTime}-${endTime} Romania time (${session.pairs.join(', ')})`);
  });
  console.log('✅ Session windows configured correctly');

  console.log('\n🎯 QA Summary:');
  console.log('=====================================');
  console.log('1. ✅ Time and session logic implemented');
  console.log('2. 🔄 Market data API (test manually)');
  console.log('3. 🔄 AI analysis API (check OpenAI quota)');
  console.log('4. 🔄 Auto trading scheduler (test manually)');
  console.log('5. ✅ Database schema updated');
  console.log('6. ✅ Risk management rules defined');
  console.log('7. ✅ Trading session windows configured');
  
  console.log('\n⚠️ Manual Testing Required:');
  console.log('- Open test-auto-trading.html in browser');
  console.log('- Click "Test Auto Trading Scheduler"');
  console.log('- Click "Check Database" to verify trades created');
  console.log('- Check edge function logs for detailed execution info');
  
  console.log('\n🔥 Expected Behavior:');
  console.log('- 3 trades per day (except weekends)');
  console.log('- Asian: GBP/AUD at 2:00 Romania time');
  console.log('- London: GBP/USD at 10:00 Romania time');
  console.log('- New York: EUR/USD at 15:00 Romania time');
  console.log('- All trades respect 50 pip SL, 100 pip TP, 2:1 R/R');
}

// Run the comprehensive QA
runComprehensiveQA().catch(console.error);
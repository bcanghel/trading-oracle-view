// Rule-Based Entry Logic and Risk/Reward Calculations

export interface EntrySignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  positionSize: number;
  confidence: number;
  strategy: string;
  reasoning: string[];
}

export interface MarketConditions {
  currentPrice: number;
  technicalAnalysis: any;
  trendAnalysis: any;
  marketSession: any;
  atr: number;
}

// Main entry logic function
export function calculateEntrySignal(conditions: MarketConditions): EntrySignal {
  const { currentPrice, technicalAnalysis, trendAnalysis, atr } = conditions;
  
  // Determine market strategy
  const strategy = determineStrategy(conditions);
  
  // Calculate entry based on strategy
  switch (strategy) {
    case 'TREND_FOLLOWING':
      return calculateTrendFollowingEntry(conditions);
    case 'MEAN_REVERSION':
      return calculateMeanReversionEntry(conditions);
    case 'BREAKOUT':
      return calculateBreakoutEntry(conditions);
    default:
      return createHoldSignal(currentPrice, 'No clear strategy identified');
  }
}

// Determine optimal strategy based on market conditions
function determineStrategy(conditions: MarketConditions): string {
  const { technicalAnalysis, trendAnalysis } = conditions;
  
  // Strong trend conditions
  if (trendAnalysis.overallTrend !== 'NEUTRAL' && 
      trendAnalysis.trendStrength === 'STRONG' &&
      Math.abs(technicalAnalysis.rsi - 50) < 20) {
    return 'TREND_FOLLOWING';
  }
  
  // Mean reversion conditions
  if (technicalAnalysis.rsi < 30 || technicalAnalysis.rsi > 70) {
    return 'MEAN_REVERSION';
  }
  
  // Breakout conditions
  const priceNearResistance = Math.abs(conditions.currentPrice - technicalAnalysis.resistance) / conditions.currentPrice < 0.002;
  const priceNearSupport = Math.abs(conditions.currentPrice - technicalAnalysis.support) / conditions.currentPrice < 0.002;
  
  if (priceNearResistance || priceNearSupport) {
    return 'BREAKOUT';
  }
  
  return 'HOLD';
}

// Trend Following Strategy
function calculateTrendFollowingEntry(conditions: MarketConditions): EntrySignal {
  const { currentPrice, technicalAnalysis, trendAnalysis, atr } = conditions;
  const reasoning: string[] = [];
  
  let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let entryPrice = currentPrice;
  let stopLoss = currentPrice;
  let takeProfit = currentPrice;
  
  // Bullish trend following
  if (trendAnalysis.overallTrend === 'BULLISH' && 
      technicalAnalysis.sma10 > technicalAnalysis.sma20 &&
      currentPrice > technicalAnalysis.sma10) {
    
    action = 'BUY';
    entryPrice = currentPrice;
    stopLoss = currentPrice - (atr * 2); // 2 ATR stop loss
    takeProfit = currentPrice + (atr * 4); // 1:2 risk/reward
    
    reasoning.push('Bullish trend confirmed');
    reasoning.push('Price above SMA10');
    reasoning.push('SMA10 > SMA20 (bullish alignment)');
  }
  
  // Bearish trend following
  else if (trendAnalysis.overallTrend === 'BEARISH' && 
           technicalAnalysis.sma10 < technicalAnalysis.sma20 &&
           currentPrice < technicalAnalysis.sma10) {
    
    action = 'SELL';
    entryPrice = currentPrice;
    stopLoss = currentPrice + (atr * 2); // 2 ATR stop loss
    takeProfit = currentPrice - (atr * 4); // 1:2 risk/reward
    
    reasoning.push('Bearish trend confirmed');
    reasoning.push('Price below SMA10');
    reasoning.push('SMA10 < SMA20 (bearish alignment)');
  }
  
  const riskRewardRatio = calculateRiskReward(entryPrice, stopLoss, takeProfit, action);
  const positionSize = calculatePositionSize(entryPrice, stopLoss, atr);
  
  return {
    action,
    entryPrice: parseFloat(entryPrice.toFixed(5)),
    stopLoss: parseFloat(stopLoss.toFixed(5)),
    takeProfit: parseFloat(takeProfit.toFixed(5)),
    riskRewardRatio,
    positionSize,
    confidence: technicalAnalysis.confidenceScore,
    strategy: 'TREND_FOLLOWING',
    reasoning
  };
}

// Mean Reversion Strategy
function calculateMeanReversionEntry(conditions: MarketConditions): EntrySignal {
  const { currentPrice, technicalAnalysis, atr } = conditions;
  const reasoning: string[] = [];
  
  let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let entryPrice = currentPrice;
  let stopLoss = currentPrice;
  let takeProfit = currentPrice;
  
  // Oversold condition - expect bounce
  if (technicalAnalysis.rsi < 30 && 
      currentPrice <= technicalAnalysis.bollinger.lower) {
    
    action = 'BUY';
    entryPrice = currentPrice;
    stopLoss = currentPrice - (atr * 1.5); // Tighter stop for mean reversion
    takeProfit = technicalAnalysis.bollinger.middle; // Target middle BB
    
    reasoning.push('RSI oversold (< 30)');
    reasoning.push('Price at lower Bollinger Band');
    reasoning.push('Mean reversion opportunity');
  }
  
  // Overbought condition - expect pullback
  else if (technicalAnalysis.rsi > 70 && 
           currentPrice >= technicalAnalysis.bollinger.upper) {
    
    action = 'SELL';
    entryPrice = currentPrice;
    stopLoss = currentPrice + (atr * 1.5); // Tighter stop for mean reversion
    takeProfit = technicalAnalysis.bollinger.middle; // Target middle BB
    
    reasoning.push('RSI overbought (> 70)');
    reasoning.push('Price at upper Bollinger Band');
    reasoning.push('Mean reversion opportunity');
  }
  
  const riskRewardRatio = calculateRiskReward(entryPrice, stopLoss, takeProfit, action);
  const positionSize = calculatePositionSize(entryPrice, stopLoss, atr);
  
  return {
    action,
    entryPrice: parseFloat(entryPrice.toFixed(5)),
    stopLoss: parseFloat(stopLoss.toFixed(5)),
    takeProfit: parseFloat(takeProfit.toFixed(5)),
    riskRewardRatio,
    positionSize,
    confidence: technicalAnalysis.confidenceScore * 0.9, // Slightly lower confidence for mean reversion
    strategy: 'MEAN_REVERSION',
    reasoning
  };
}

// Breakout Strategy
function calculateBreakoutEntry(conditions: MarketConditions): EntrySignal {
  const { currentPrice, technicalAnalysis, atr } = conditions;
  const reasoning: string[] = [];
  
  let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let entryPrice = currentPrice;
  let stopLoss = currentPrice;
  let takeProfit = currentPrice;
  
  // Resistance breakout
  const resistanceDistance = (technicalAnalysis.resistance - currentPrice) / currentPrice;
  if (resistanceDistance > 0 && resistanceDistance < 0.002) { // Within 0.2% of resistance
    
    action = 'BUY';
    entryPrice = technicalAnalysis.resistance + (atr * 0.1); // Entry above resistance
    stopLoss = technicalAnalysis.resistance - (atr * 1.5); // Stop below resistance
    takeProfit = technicalAnalysis.resistance + (atr * 3); // 1:2 risk/reward
    
    reasoning.push('Price approaching resistance');
    reasoning.push('Potential breakout setup');
    reasoning.push('Entry above resistance level');
  }
  
  // Support breakdown
  const supportDistance = (currentPrice - technicalAnalysis.support) / currentPrice;
  if (supportDistance > 0 && supportDistance < 0.002) { // Within 0.2% of support
    
    action = 'SELL';
    entryPrice = technicalAnalysis.support - (atr * 0.1); // Entry below support
    stopLoss = technicalAnalysis.support + (atr * 1.5); // Stop above support
    takeProfit = technicalAnalysis.support - (atr * 3); // 1:2 risk/reward
    
    reasoning.push('Price approaching support');
    reasoning.push('Potential breakdown setup');
    reasoning.push('Entry below support level');
  }
  
  const riskRewardRatio = calculateRiskReward(entryPrice, stopLoss, takeProfit, action);
  const positionSize = calculatePositionSize(entryPrice, stopLoss, atr);
  
  return {
    action,
    entryPrice: parseFloat(entryPrice.toFixed(5)),
    stopLoss: parseFloat(stopLoss.toFixed(5)),
    takeProfit: parseFloat(takeProfit.toFixed(5)),
    riskRewardRatio,
    positionSize,
    confidence: technicalAnalysis.confidenceScore * 0.8, // Lower confidence for breakouts
    strategy: 'BREAKOUT',
    reasoning
  };
}

// Risk/Reward Calculation
function calculateRiskReward(entryPrice: number, stopLoss: number, takeProfit: number, action: 'BUY' | 'SELL' | 'HOLD'): number {
  if (action === 'HOLD') return 0;
  
  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(takeProfit - entryPrice);
  
  if (risk === 0) return 0;
  return parseFloat((reward / risk).toFixed(2));
}

// Position Size Calculation (based on ATR and risk management)
function calculatePositionSize(entryPrice: number, stopLoss: number, atr: number): number {
  // Risk 1% of account per trade (simplified calculation)
  const accountBalance = 10000; // Assume $10,000 account
  const riskPerTrade = accountBalance * 0.01; // 1% risk
  
  const riskPerUnit = Math.abs(entryPrice - stopLoss);
  if (riskPerUnit === 0) return 0;
  
  const positionSize = riskPerTrade / riskPerUnit;
  return parseFloat(positionSize.toFixed(2));
}

// Create HOLD signal
function createHoldSignal(currentPrice: number, reason: string): EntrySignal {
  return {
    action: 'HOLD',
    entryPrice: currentPrice,
    stopLoss: currentPrice,
    takeProfit: currentPrice,
    riskRewardRatio: 0,
    positionSize: 0,
    confidence: 50,
    strategy: 'HOLD',
    reasoning: [reason]
  };
}
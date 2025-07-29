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
  // IMPROVEMENT: Use a scoring system to determine the best strategy
  const strategy = determineStrategy(conditions);
  
  switch (strategy) {
    case 'TREND_FOLLOWING':
      return calculateTrendFollowingEntry(conditions);
    case 'MEAN_REVERSION':
      return calculateMeanReversionEntry(conditions);
    case 'BREAKOUT':
      return calculateBreakoutEntry(conditions);
    default:
      return createHoldSignal(conditions.currentPrice, 'Market conditions are unclear, no high-probability strategy found.');
  }
}

// IMPROVEMENT: More sophisticated strategy determination using a scoring system
function determineStrategy(conditions: MarketConditions): string {
    const { technicalAnalysis, trendAnalysis } = conditions;
    const scores = { TREND_FOLLOWING: 0, MEAN_REVERSION: 0, BREAKOUT: 0 };

    // Score Trend Following
    if (trendAnalysis.trendStrength === 'STRONG') scores.TREND_FOLLOWING += 30;
    if (trendAnalysis.overallTrend !== 'NEUTRAL') scores.TREND_FOLLOWING += 20;
    if (technicalAnalysis.macd.histogram > 0 && trendAnalysis.overallTrend === 'BULLISH') scores.TREND_FOLLOWING += 15;
    if (technicalAnalysis.macd.histogram < 0 && trendAnalysis.overallTrend === 'BEARISH') scores.TREND_FOLLOWING += 15;
    if (technicalAnalysis.volatility.status === 'MODERATE') scores.TREND_FOLLOWING += 10;

    // Score Mean Reversion
    if (technicalAnalysis.rsi < 30 || technicalAnalysis.rsi > 70) scores.MEAN_REVERSION += 40;
    const priceNearUpperBand = Math.abs(conditions.currentPrice - technicalAnalysis.bollinger.upper) / conditions.currentPrice < 0.001;
    const priceNearLowerBand = Math.abs(conditions.currentPrice - technicalAnalysis.bollinger.lower) / conditions.currentPrice < 0.001;
    if (priceNearUpperBand || priceNearLowerBand) scores.MEAN_REVERSION += 30;
    if (trendAnalysis.trendStrength === 'WEAK' || trendAnalysis.overallTrend === 'NEUTRAL') scores.MEAN_REVERSION += 20;
    if (technicalAnalysis.volatility.status === 'LOW') scores.MEAN_REVERSION += 10;


    // Score Breakout
    if (technicalAnalysis.volatility.status === 'LOW') scores.BREAKOUT += 30; // Breakouts often follow low volatility
    if (technicalAnalysis.volatility.bbandWidth < 1.5) scores.BREAKOUT += 20; // Bollinger Bands Squeeze
    const priceNearResistance = Math.abs(conditions.currentPrice - technicalAnalysis.resistance) / conditions.currentPrice < 0.005;
    const priceNearSupport = Math.abs(conditions.currentPrice - technicalAnalysis.support) / conditions.currentPrice < 0.005;
    if (priceNearResistance || priceNearSupport) scores.BREAKOUT += 30;

    // Determine the winning strategy
    let bestStrategy = 'HOLD';
    let maxScore = 50; // Set a minimum threshold to act
    for (const strategy in scores) {
        if (scores[strategy] > maxScore) {
            maxScore = scores[strategy];
            bestStrategy = strategy;
        }
    }
    return bestStrategy;
}

// Trend Following Strategy
function calculateTrendFollowingEntry(conditions: MarketConditions): EntrySignal {
    const { currentPrice, technicalAnalysis, trendAnalysis, atr } = conditions;
    const reasoning: string[] = [];
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    
    if (trendAnalysis.overallTrend === 'BULLISH' && currentPrice > technicalAnalysis.sma20 && technicalAnalysis.sma10 > technicalAnalysis.sma20) {
        action = 'BUY';
        const stopLoss = currentPrice - (atr * 2);
        // IMPROVEMENT: Target the next major resistance level for a more dynamic take profit
        const takeProfit = technicalAnalysis.resistance > currentPrice ? technicalAnalysis.resistance : currentPrice + (atr * 4);
        reasoning.push('Strong bullish trend identified.', 'Price is above key moving averages.', `Take profit set at resistance level: ${takeProfit}`);
        return createSignal(action, currentPrice, stopLoss, takeProfit, atr, technicalAnalysis.confidenceScore, 'TREND_FOLLOWING', reasoning);
    }
    
    if (trendAnalysis.overallTrend === 'BEARISH' && currentPrice < technicalAnalysis.sma20 && technicalAnalysis.sma10 < technicalAnalysis.sma20) {
        action = 'SELL';
        const stopLoss = currentPrice + (atr * 2);
        // IMPROVEMENT: Target the next major support level
        const takeProfit = technicalAnalysis.support < currentPrice ? technicalAnalysis.support : currentPrice - (atr * 4);
        reasoning.push('Strong bearish trend identified.', 'Price is below key moving averages.', `Take profit set at support level: ${takeProfit}`);
        return createSignal(action, currentPrice, stopLoss, takeProfit, atr, technicalAnalysis.confidenceScore, 'TREND_FOLLOWING', reasoning);
    }
    
    return createHoldSignal(currentPrice, 'Trend conditions not met.');
}

// Mean Reversion Strategy
function calculateMeanReversionEntry(conditions: MarketConditions): EntrySignal {
    const { currentPrice, technicalAnalysis, atr } = conditions;
    const reasoning: string[] = [];
    
    if (technicalAnalysis.rsi < 30 && currentPrice <= technicalAnalysis.bollinger.lower) {
        const action = 'BUY';
        const stopLoss = currentPrice - (atr * 1.5);
        // IMPROVEMENT: Target is still the mean (middle band), which is logical for this strategy.
        const takeProfit = technicalAnalysis.bollinger.middle;
        reasoning.push('RSI is oversold (<30).', 'Price is at or below the lower Bollinger Band.');
        return createSignal(action, currentPrice, stopLoss, takeProfit, atr, technicalAnalysis.confidenceScore, 'MEAN_REVERSION', reasoning);
    }
    
    if (technicalAnalysis.rsi > 70 && currentPrice >= technicalAnalysis.bollinger.upper) {
        const action = 'SELL';
        const stopLoss = currentPrice + (atr * 1.5);
        const takeProfit = technicalAnalysis.bollinger.middle;
        reasoning.push('RSI is overbought (>70).', 'Price is at or above the upper Bollinger Band.');
        return createSignal(action, currentPrice, stopLoss, takeProfit, atr, technicalAnalysis.confidenceScore, 'MEAN_REVERSION', reasoning);
    }

    return createHoldSignal(currentPrice, 'Mean reversion conditions not met.');
}

// Breakout Strategy
function calculateBreakoutEntry(conditions: MarketConditions): EntrySignal {
    const { currentPrice, technicalAnalysis, atr } = conditions;
    const reasoning: string[] = [];

    // IMPROVEMENT: Breakout logic now looks for a confirmed close, not just proximity.
    // This logic is simplified here. A real implementation would need to check previous candle state.
    // We'll assume for now the trigger is a strong push into the level.
    const isBreakingResistance = currentPrice > technicalAnalysis.resistance && currentPrice < technicalAnalysis.resistance + (atr * 0.5);
    if (isBreakingResistance) {
        const action = 'BUY';
        const entryPrice = technicalAnalysis.resistance;
        const stopLoss = entryPrice - (atr * 1.5);
        const takeProfit = entryPrice + (atr * 3);
        reasoning.push('Price shows signs of breaking above key resistance.', 'Entering on a potential breakout.');
        return createSignal(action, entryPrice, stopLoss, takeProfit, atr, technicalAnalysis.confidenceScore * 0.8, 'BREAKOUT', reasoning);
    }

    const isBreakingSupport = currentPrice < technicalAnalysis.support && currentPrice > technicalAnalysis.support - (atr * 0.5);
    if (isBreakingSupport) {
        const action = 'SELL';
        const entryPrice = technicalAnalysis.support;
        const stopLoss = entryPrice + (atr * 1.5);
        const takeProfit = entryPrice - (atr * 3);
        reasoning.push('Price shows signs of breaking below key support.', 'Entering on a potential breakdown.');
        return createSignal(action, entryPrice, stopLoss, takeProfit, atr, technicalAnalysis.confidenceScore * 0.8, 'BREAKOUT', reasoning);
    }

    return createHoldSignal(currentPrice, 'No breakout setup identified.');
}

// Helper function to create the final signal object
function createSignal(action: 'BUY' | 'SELL', entryPrice: number, stopLoss: number, takeProfit: number, atr: number, confidence: number, strategy: string, reasoning: string[]): EntrySignal {
    const riskRewardRatio = calculateRiskReward(entryPrice, stopLoss, takeProfit, action);
    const positionSize = calculatePositionSize(entryPrice, stopLoss);
    return {
        action,
        entryPrice: parseFloat(entryPrice.toFixed(5)),
        stopLoss: parseFloat(stopLoss.toFixed(5)),
        takeProfit: parseFloat(takeProfit.toFixed(5)),
        riskRewardRatio,
        positionSize,
        confidence,
        strategy,
        reasoning
    };
}

function calculateRiskReward(entryPrice: number, stopLoss: number, takeProfit: number, action: 'BUY' | 'SELL' | 'HOLD'): number {
    if (action === 'HOLD') return 0;
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);
    if (risk === 0) return 0;
    return parseFloat((reward / risk).toFixed(2));
}

function calculatePositionSize(entryPrice: number, stopLoss: number): number {
    const accountBalance = 10000;
    const riskPerTrade = accountBalance * 0.01;
    const riskPerUnit = Math.abs(entryPrice - stopLoss);
    if (riskPerUnit === 0) return 0;
    return parseFloat((riskPerTrade / riskPerUnit).toFixed(2));
}

function createHoldSignal(currentPrice: number, reason: string): EntrySignal {
    return { action: 'HOLD', entryPrice: currentPrice, stopLoss: 0, takeProfit: 0, riskRewardRatio: 0, positionSize: 0, confidence: 0, strategy: 'HOLD', reasoning: [reason] };
}
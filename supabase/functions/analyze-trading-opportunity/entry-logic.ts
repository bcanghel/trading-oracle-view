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
        if (scores[strategy as keyof typeof scores] > maxScore) {
            maxScore = scores[strategy as keyof typeof scores];
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
        
        // Strategic entry: Wait for pullback to key support levels
        let entryPrice = currentPrice;
        const sma20Level = technicalAnalysis.sma20;
        const fibLevel = technicalAnalysis.fibonacci?.level_382 || (currentPrice - (atr * 1.2));
        const supportLevel = technicalAnalysis.support;
        
        // Choose the best strategic entry level closest to current price but offering value
        const potentialEntries = [sma20Level, fibLevel, supportLevel].filter(level => level < currentPrice && level > currentPrice - (atr * 2));
        if (potentialEntries.length > 0) {
            entryPrice = Math.max(...potentialEntries); // Highest level below current price
            reasoning.push('Strong bullish trend identified.', `Strategic entry at ${entryPrice.toFixed(5)} - waiting for pullback to key support level.`);
        } else {
            reasoning.push('Strong bullish trend identified.', 'No significant pullback expected - market entry recommended.');
        }
        
        const stopLoss = entryPrice - (atr * 2);
        const takeProfit = technicalAnalysis.resistance > entryPrice ? technicalAnalysis.resistance : entryPrice + (atr * 4);
        reasoning.push(`Take profit set at resistance level: ${takeProfit.toFixed(5)}`);
        return createSignal(action, entryPrice, stopLoss, takeProfit, atr, technicalAnalysis.confidenceScore, 'TREND_FOLLOWING', reasoning);
    }
    
    if (trendAnalysis.overallTrend === 'BEARISH' && currentPrice < technicalAnalysis.sma20 && technicalAnalysis.sma10 < technicalAnalysis.sma20) {
        action = 'SELL';
        
        // Strategic entry: Wait for pullback to key resistance levels
        let entryPrice = currentPrice;
        const sma20Level = technicalAnalysis.sma20;
        const fibLevel = technicalAnalysis.fibonacci?.level_618 || (currentPrice + (atr * 1.2));
        const resistanceLevel = technicalAnalysis.resistance;
        
        // Choose the best strategic entry level closest to current price but offering value
        const potentialEntries = [sma20Level, fibLevel, resistanceLevel].filter(level => level > currentPrice && level < currentPrice + (atr * 2));
        if (potentialEntries.length > 0) {
            entryPrice = Math.min(...potentialEntries); // Lowest level above current price
            reasoning.push('Strong bearish trend identified.', `Strategic entry at ${entryPrice.toFixed(5)} - waiting for pullback to key resistance level.`);
        } else {
            reasoning.push('Strong bearish trend identified.', 'No significant pullback expected - market entry recommended.');
        }
        
        const stopLoss = entryPrice + (atr * 2);
        const takeProfit = technicalAnalysis.support < entryPrice ? technicalAnalysis.support : entryPrice - (atr * 4);
        reasoning.push(`Take profit set at support level: ${takeProfit.toFixed(5)}`);
        return createSignal(action, entryPrice, stopLoss, takeProfit, atr, technicalAnalysis.confidenceScore, 'TREND_FOLLOWING', reasoning);
    }
    
    return createHoldSignal(currentPrice, 'Trend conditions not met.');
}

// Mean Reversion Strategy
function calculateMeanReversionEntry(conditions: MarketConditions): EntrySignal {
    const { currentPrice, technicalAnalysis, atr } = conditions;
    const reasoning: string[] = [];
    
    if (technicalAnalysis.rsi < 30 && currentPrice <= technicalAnalysis.bollinger.lower) {
        const action = 'BUY';
        
        // Strategic entry: Wait for deeper oversold levels or key support confluence
        let entryPrice = currentPrice;
        const lowerBandLevel = technicalAnalysis.bollinger.lower;
        const supportLevel = technicalAnalysis.support;
        const deepOversoldLevel = currentPrice - (atr * 0.5); // Slightly lower for better entry
        
        // Choose the most strategic entry point
        const potentialEntries = [lowerBandLevel, supportLevel, deepOversoldLevel].filter(level => level <= currentPrice);
        if (potentialEntries.length > 0) {
            entryPrice = Math.min(...potentialEntries); // Lowest level for best value
            if (entryPrice < currentPrice) {
                reasoning.push('RSI is oversold (<30).', `Strategic entry at ${entryPrice.toFixed(5)} - waiting for deeper oversold level or support confluence.`);
            } else {
                reasoning.push('RSI is oversold (<30).', 'Price is at optimal oversold entry level.');
            }
        }
        
        const stopLoss = entryPrice - (atr * 1.5);
        const takeProfit = technicalAnalysis.bollinger.middle;
        reasoning.push(`Target mean reversion to middle Bollinger Band: ${takeProfit.toFixed(5)}`);
        return createSignal(action, entryPrice, stopLoss, takeProfit, atr, technicalAnalysis.confidenceScore, 'MEAN_REVERSION', reasoning);
    }
    
    if (technicalAnalysis.rsi > 70 && currentPrice >= technicalAnalysis.bollinger.upper) {
        const action = 'SELL';
        
        // Strategic entry: Wait for higher overbought levels or key resistance confluence
        let entryPrice = currentPrice;
        const upperBandLevel = technicalAnalysis.bollinger.upper;
        const resistanceLevel = technicalAnalysis.resistance;
        const deepOverboughtLevel = currentPrice + (atr * 0.5); // Slightly higher for better entry
        
        // Choose the most strategic entry point
        const potentialEntries = [upperBandLevel, resistanceLevel, deepOverboughtLevel].filter(level => level >= currentPrice);
        if (potentialEntries.length > 0) {
            entryPrice = Math.max(...potentialEntries); // Highest level for best value
            if (entryPrice > currentPrice) {
                reasoning.push('RSI is overbought (>70).', `Strategic entry at ${entryPrice.toFixed(5)} - waiting for deeper overbought level or resistance confluence.`);
            } else {
                reasoning.push('RSI is overbought (>70).', 'Price is at optimal overbought entry level.');
            }
        }
        
        const stopLoss = entryPrice + (atr * 1.5);
        const takeProfit = technicalAnalysis.bollinger.middle;
        reasoning.push(`Target mean reversion to middle Bollinger Band: ${takeProfit.toFixed(5)}`);
        return createSignal(action, entryPrice, stopLoss, takeProfit, atr, technicalAnalysis.confidenceScore, 'MEAN_REVERSION', reasoning);
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
// Deterministic Signal Engine - No-LLM Fallback/Primary Analysis Engine

import { EnhancedFeatures } from './enhanced-indicators.ts';

export interface DeterministicAnalysis {
  action: 'BUY' | 'SELL';
  confidence: number; // 20-90
  entry: number;
  stopLoss: number;
  takeProfit: number;
  support: number;
  resistance: number;
  reasoning: string[];
  riskReward: number;
  entryConditions?: string;
  entryTiming?: string;
  volumeConfirmation?: string;
  candlestickSignals?: string;
  algorithmicStrategy: string;
  algorithmicPositionSize: number;
}

export function generateDeterministicSignal(
  symbol: string,
  currentData: any,
  features: EnhancedFeatures,
  sessionContext: any,
  currentPrice: number
): DeterministicAnalysis | null {
  
  // Validate required data - no fallbacks allowed
  if (!features) {
    throw new Error('Enhanced features data is required');
  }
  if (!features.atr14 && !features.atr20) {
    throw new Error(`ATR data not available for ${symbol}`);
  }
  if (!features.srZones || features.srZones.length === 0) {
    throw new Error('Support/Resistance zones data is required');
  }
  
  // === HARD PRE-GATES ===
  const reasoning: string[] = [];
  let gated = false; // if any gate triggers, we still produce a safe low-confidence signal
  
  // Weekend/Holiday gate (soft)
  if (sessionContext.isWeekendOrHoliday) {
    reasoning.push("Market closed: Weekend/Holiday period");
    gated = true;
  }
  
  // EOD gate (120 minutes before close) - soften to warning
  if (sessionContext.minutesToEOD < 120) {
    reasoning.push(`Too close to EOD: ${sessionContext.minutesToEOD} minutes remaining`);
    gated = true;
  }
  
  // Spread/Activity gates - soften to penalties rather than hard stops
  if (features.spreadZ > 2.0) {
    reasoning.push(`High spread: Z-score ${features.spreadZ.toFixed(2)}`);
    gated = true;
  }
  
  if (features.activityScore < -1.0) {
    reasoning.push(`Low activity: Score ${features.activityScore.toFixed(2)}`);
    gated = true;
  }
  
  // === STRATEGY SELECTION ===
  let strategy: 'BREAKOUT' | 'TREND' | 'MEANREV' | null = null;
  let setupReasoning: string[] = [];
  
  // BREAKOUT Setup
  if (features.squeeze && 
      Math.abs(currentPrice - (features.or60.high + features.or60.low) / 2) <= 0.2 * features.atr20 &&
      features.confluenceScore >= 60) {
    strategy = 'BREAKOUT';
    setupReasoning.push("Squeeze detected with OR60 proximity");
    setupReasoning.push(`Confluence score: ${features.confluenceScore}`);
  }
  
  // TREND Setup (if no breakout)
  else if (features.confluenceScore >= 55) {
    const bullishTrend = currentPrice > features.ema100 && features.ema20Slope > 0 && features.bias4h > 0;
    const bearishTrend = currentPrice < features.ema100 && features.ema20Slope < 0 && features.bias4h < 0;
    
    if (bullishTrend || bearishTrend) {
      strategy = 'TREND';
      setupReasoning.push(bullishTrend ? "Bullish trend alignment" : "Bearish trend alignment");
      setupReasoning.push(`Price vs EMA100: ${features.distToEMA100.toFixed(1)} bps`);
      setupReasoning.push(`4H bias: ${features.bias4h.toFixed(2)}`);
    }
  }
  
  // MEANREV Setup (if no trend or breakout)
  else if (features.confluenceScore >= 50 &&
           features.distanceToSRZone <= 0.15 * features.atr14 &&
           features.adrUsedToday <= 85) {
    
    // RSI extreme conditions for mean reversion
    const rsi = calculateSimpleRSI(currentData.historicalData || [], 14);
    if (rsi < 30 || rsi > 70) {
      strategy = 'MEANREV';
      setupReasoning.push(`RSI extreme: ${rsi.toFixed(1)}`);
      setupReasoning.push(`Near SR zone: ${features.distanceToSRZone.toFixed(5)}`);
      setupReasoning.push(`ADR used: ${features.adrUsedToday.toFixed(1)}%`);
    }
  }
  
  // No valid setup
  if (!strategy) {
    reasoning.push("No valid setup detected");
    reasoning.push(`Confluence: ${features.confluenceScore}, Squeeze: ${features.squeeze}`);
    reasoning.push(`ADR used: ${features.adrUsedToday.toFixed(1)}%`);
    
    if (gated) {
      // Build a safe, low-confidence placeholder signal instead of failing hard
      const biasLong = (features.bias4h ?? 0) >= 0 || features.ema20Slope > 0;
      const action: 'BUY' | 'SELL' = biasLong ? 'BUY' : 'SELL';
      // Require actual ATR data - no fallbacks
      if (!features.atr14 && !features.atr20) {
        throw new Error(`ATR data not available for ${symbol} - cannot generate fallback signal`);
      }
      const atr = features.atr14 || features.atr20;
      const entry = currentPrice;
      const minStopDistance = getMinimumStopDistance(symbol);
      const minTakeProfitDistance = getMinimumTakeProfitDistance(symbol);
      
      const stopLoss = biasLong ? entry - Math.max(0.8 * atr, minStopDistance) : entry + Math.max(0.8 * atr, minStopDistance);
      const risk = Math.abs(entry - stopLoss) || 1e-6;
      const desiredRR = 1.5;
      let takeProfit = biasLong ? entry + Math.max(risk * desiredRR, minTakeProfitDistance) : entry - Math.max(risk * desiredRR, minTakeProfitDistance);

      // Nearest S/R
      let support = currentPrice;
      let resistance = currentPrice;
      const supportZones = features.srZones.filter(z => z.type === 'support' && z.max < currentPrice);
      const resistanceZones = features.srZones.filter(z => z.type === 'resistance' && z.min > currentPrice);
      if (supportZones.length > 0) {
        support = supportZones.reduce((nearest, zone) => Math.abs(zone.max - currentPrice) < Math.abs(nearest - currentPrice) ? zone.max : nearest, supportZones[0].max);
      }
      if (resistanceZones.length > 0) {
        resistance = resistanceZones.reduce((nearest, zone) => Math.abs(zone.min - currentPrice) < Math.abs(nearest - currentPrice) ? zone.min : nearest, resistanceZones[0].min);
      }

      let riskReward = Math.abs(takeProfit - entry) / risk;
      if (!Number.isFinite(riskReward) || riskReward < 1.5) {
        takeProfit = biasLong ? entry + risk * 1.5 : entry - risk * 1.5;
        riskReward = 1.5;
      }
      if (riskReward > 2.5) {
        takeProfit = biasLong ? entry + risk * 2.5 : entry - risk * 2.5;
        riskReward = 2.5;
      }

      let confidence = 25;
      if (sessionContext.isWeekendOrHoliday) confidence -= 5;
      if (sessionContext.minutesToEOD < 120) confidence -= 5;
      if (features.activityScore < -1.0) confidence -= 5;
      if (features.spreadZ > 2.0) confidence -= 5;
      confidence = Math.max(20, Math.min(35, confidence));

      reasoning.push('Fallback: Low-confidence placeholder due to market conditions (no auto-execution).');

      return {
        action,
        confidence,
        entry,
        stopLoss,
        takeProfit,
        support,
        resistance,
        reasoning,
        riskReward,
        entryConditions: 'Avoid entries until normal market conditions resume; use this only for planning.',
        entryTiming: generateEntryTiming('TREND', sessionContext),
        volumeConfirmation: 'Wait for activity to normalize; volume currently insufficient',
        candlestickSignals: 'Do not act solely on this placeholder signal',
        algorithmicStrategy: 'NONE',
        algorithmicPositionSize: 0,
      };
    }

    return null;
  }
  
  // === DIRECTION AND LEVELS ===
  const direction = determineDirection(strategy, features, currentPrice);
  if (!direction) {
    reasoning.push("Could not determine valid direction");
    return null;
  }
  
  const levels = 
    calculateLevels(strategy, direction, currentPrice, features, symbol);
  let { action, entry, stopLoss, takeProfit, support, resistance } = levels;
  
  // === R:R TARGETING AND TP ADJUSTMENT ===
  const risk = Math.abs(entry - stopLoss) || 1e-6;
  const isLong = action === 'BUY';

  const chooseTargetRR = () => {
    let target = 2.0; // baseline
    if (strategy === 'MEANREV' || features.inSRZone || (features.distanceToSRZone <= 0.1 * (features.atr14 || 1))) target = 1.75;
    if (strategy === 'BREAKOUT' && features.squeeze) target = 2.25;
    if (strategy === 'TREND' && Math.abs(features.bias4h) > 0.5 && features.confluenceScore >= 65 && features.adrUsedToday < 80) target = 2.25;
    return target;
  };

  const MAX_RR = 2.5;
  const MIN_RR = 1.5;
  let desiredRR = Math.min(MAX_RR, Math.max(MIN_RR, chooseTargetRR()));

  // RR-based TP
  let tpByRR = isLong ? entry + risk * desiredRR : entry - risk * desiredRR;

  // Respect nearest S/R if it caps the move
  if (isLong && Number.isFinite(resistance) && resistance > entry) {
    tpByRR = Math.min(tpByRR, resistance);
  } else if (!isLong && Number.isFinite(support) && support < entry) {
    tpByRR = Math.max(tpByRR, support);
  }

  takeProfit = tpByRR;

  // Final clamp to bounds
  let riskReward = Math.abs(takeProfit - entry) / risk;
  if (riskReward > MAX_RR) {
    takeProfit = isLong ? entry + risk * MAX_RR : entry - risk * MAX_RR;
    riskReward = MAX_RR;
  } else if (riskReward < MIN_RR) {
    takeProfit = isLong ? entry + risk * MIN_RR : entry - risk * MIN_RR;
    riskReward = MIN_RR;
  }

  reasoning.push(`Target R/R adjusted to ${riskReward.toFixed(2)} within [${MIN_RR}, ${MAX_RR}] using ${strategy} + S/R alignment`);

  
  // === CONFIDENCE CALCULATION ===
  let confidence = 50; // Base
  confidence += Math.floor(features.confluenceScore / 2); // +0 to +50
  
  // Strategy bonuses
  if (strategy === 'BREAKOUT' && features.squeeze) confidence += 10;
  if (strategy === 'TREND' && Math.abs(features.bias4h) > 0.5) confidence += 5;
  
  // Session bonus
  if (sessionContext.session === 'Overlap' || sessionContext.session === 'London') {
    confidence += 5;
  }
  
  // ADR penalty
  if (features.adrUsedToday > 80) confidence -= 10;
  if (features.adrUsedToday > 90) confidence -= 20;
  
  // Clamp to valid range
  confidence = Math.max(20, Math.min(90, confidence));
  
  // === POSITION SIZING ===
  const positionSize = calculateATRPositionSize(symbol, entry, stopLoss, features.atr14);
  
  // === BUILD REASONING ===
  reasoning.push(`Strategy: ${strategy}`);
  reasoning.push(...setupReasoning);
  reasoning.push(`Entry: ${entry.toFixed(5)}, SL: ${stopLoss.toFixed(5)}, TP: ${takeProfit.toFixed(5)}`);
  reasoning.push(`R/R: ${riskReward.toFixed(2)}, Confidence: ${confidence}%`);
  reasoning.push(`Session: ${sessionContext.session}, EOD: ${sessionContext.minutesToEOD}min`);
  reasoning.push(`Position size: ${positionSize} units`);
  
  return {
    action,
    confidence,
    entry,
    stopLoss,
    takeProfit,
    support,
    resistance,
    reasoning,
    riskReward,
    entryConditions: generateEntryConditions(strategy, features),
    entryTiming: generateEntryTiming(strategy, sessionContext),
    volumeConfirmation: generateVolumeConfirmation(features),
    candlestickSignals: generateCandlestickSignals(strategy, features),
    algorithmicStrategy: strategy,
    algorithmicPositionSize: positionSize
  };
}

function determineDirection(
  strategy: 'BREAKOUT' | 'TREND' | 'MEANREV',
  features: EnhancedFeatures,
  currentPrice: number
): 'LONG' | 'SHORT' | null {
  
  switch (strategy) {
    case 'BREAKOUT':
      // Direction based on OR60 break and squeeze expansion
      if (currentPrice > features.or60.high && features.ema20Slope > 0) return 'LONG';
      if (currentPrice < features.or60.low && features.ema20Slope < 0) return 'SHORT';
      // Anticipate break direction
      if (features.distanceToVWAP > 0 && features.ema20 > features.ema50) return 'LONG';
      if (features.distanceToVWAP < 0 && features.ema20 < features.ema50) return 'SHORT';
      break;
      
    case 'TREND':
      // Follow the established trend
      if (currentPrice > features.ema100 && features.ema20Slope > 0 && features.bias4h > 0) {
        return 'LONG';
      }
      if (currentPrice < features.ema100 && features.ema20Slope < 0 && features.bias4h < 0) {
        return 'SHORT';
      }
      break;
      
    case 'MEANREV':
      // Counter-trend at extremes
      const rsi = 50; // Simplified - would use actual RSI
      if (rsi > 70 && features.inSRZone) return 'SHORT';
      if (rsi < 30 && features.inSRZone) return 'LONG';
      break;
  }
  
  return null;
}

function calculateLevels(
  strategy: 'BREAKOUT' | 'TREND' | 'MEANREV',
  direction: 'LONG' | 'SHORT',
  currentPrice: number,
  features: EnhancedFeatures,
  symbol: string
) {
  const isLong = direction === 'LONG';
  const action: 'BUY' | 'SELL' = isLong ? 'BUY' : 'SELL';
  
  // ATR-based stops and targets
  let slMultiplier = 0.8; // Default
  let tpMultiplier = 1.6; // Default 2:1 R/R
  
  // Strategy-specific adjustments
  switch (strategy) {
    case 'MEANREV':
      slMultiplier = 0.6;
      tpMultiplier = 1.2;
      break;
    case 'TREND':
    case 'BREAKOUT':
      slMultiplier = 0.8;
      tpMultiplier = 1.6;
      break;
  }
  
  const atr = features.atr14 || features.atr20;
  if (!atr) {
    throw new Error(`ATR data not available for ${symbol}`);
  }
  const stopDistance = Math.max(atr * slMultiplier, getMinimumStopDistance(symbol));
  const targetDistance = Math.max(atr * tpMultiplier, getMinimumTakeProfitDistance(symbol));
  
  const entry = currentPrice; // Market order for simplicity
  const stopLoss = isLong ? entry - stopDistance : entry + stopDistance;
  const takeProfit = isLong ? entry + targetDistance : entry - targetDistance;
  
  // Support/Resistance from nearest zones
  let support = currentPrice;
  let resistance = currentPrice;
  
  const supportZones = features.srZones.filter(z => z.type === 'support' && z.max < currentPrice);
  const resistanceZones = features.srZones.filter(z => z.type === 'resistance' && z.min > currentPrice);
  
  if (supportZones.length > 0) {
    support = supportZones.reduce((nearest, zone) => 
      Math.abs(zone.max - currentPrice) < Math.abs(nearest - currentPrice) ? zone.max : nearest, 
      supportZones[0].max
    );
  }
  
  if (resistanceZones.length > 0) {
    resistance = resistanceZones.reduce((nearest, zone) => 
      Math.abs(zone.min - currentPrice) < Math.abs(nearest - currentPrice) ? zone.min : nearest,
      resistanceZones[0].min
    );
  }
  
  return { action, entry, stopLoss, takeProfit, support, resistance };
}

function calculateATRPositionSize(symbol: string, entryPrice: number, stopLoss: number, atr: number): number {
  const accountEquity = 10000; // Default account size
  const riskPercentage = 0.01; // 1% risk
  
  const riskAmount = accountEquity * riskPercentage;
  const stopDistance = Math.abs(entryPrice - stopLoss);
  const pipMultiplier = symbol.includes('JPY') ? 100 : 10000;
  const pipValue = symbol.includes('JPY') ? 9.09 : 10; // Simplified
  
  const riskPips = stopDistance * pipMultiplier;
  const positionUnits = riskPips > 0 ? Math.floor(riskAmount / (riskPips * pipValue)) : 0;
  
  return Math.max(0, positionUnits);
}

function generateEntryConditions(strategy: string, features: EnhancedFeatures): string {
  switch (strategy) {
    case 'BREAKOUT':
      return `Wait for squeeze expansion with volume confirmation. Entry on close beyond OR60 ${features.or60.state}`;
    case 'TREND':
      return `Enter on pullback to EMA20 (${features.ema20.toFixed(5)}) with bullish/bearish close`;
    case 'MEANREV':
      return `Enter at SR zone with RSI divergence confirmation`;
    default:
      return 'Market order execution';
  }
}

function generateEntryTiming(strategy: string, sessionContext: any): string {
  const session = sessionContext.session;
  const eodMin = sessionContext.minutesToEOD;
  
  if (session === 'Overlap') return 'Optimal timing - London-NY overlap period';
  if (session === 'London') return 'Good timing - London session active';
  if (eodMin < 180) return `Caution - Only ${eodMin} minutes until EOD`;
  
  return 'Standard market hours';
}

function generateVolumeConfirmation(features: EnhancedFeatures): string {
  if (features.activityScore > 1) return 'High activity - strong volume confirmation';
  if (features.activityScore > 0) return 'Moderate activity - adequate volume';
  return 'Low activity - monitor for volume pickup';
}

function generateCandlestickSignals(strategy: string, features: EnhancedFeatures): string {
  const bodyRatio = features.candleBodyRatio;
  
  if (bodyRatio > 0.7) return 'Strong directional candle - good momentum signal';
  if (bodyRatio > 0.5) return 'Moderate body size - decent directional bias';
  return 'Small body - indecision or consolidation';
}

function calculateSimpleRSI(data: any[], period: number): number {
  if (!data || data.length < period + 1) return 50;
  
  const closes = data.slice(-period - 1).map(d => parseFloat(d.close));
  let gains = 0, losses = 0;
  
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  
  return 100 - (100 / (1 + rs));
}

// Helper functions for minimum distances only - no fallback ATR data
function getMinimumStopDistance(symbol: string): number {
  // Minimum stop loss distances in price units
  const pair = symbol.replace('/', '');
  
  const minStopMapping: { [key: string]: number } = {
    'GBPUSD': 0.0025,  // 25 pips minimum
    'EURUSD': 0.0020,  // 20 pips minimum
    'USDCHF': 0.0020,  // 20 pips minimum
    'AUDUSD': 0.0025,  // 25 pips minimum
    'NZDUSD': 0.0030,  // 30 pips minimum
    'EURGBP': 0.0015,  // 15 pips minimum
    'EURJPY': 0.25,    // 25 pips minimum (JPY)
    'GBPJPY': 0.35,    // 35 pips minimum (JPY)
    'USDJPY': 0.20,    // 20 pips minimum (JPY)
    'GBPAUD': 0.0030,  // 30 pips minimum
    'EURCAD': 0.0025,  // 25 pips minimum
    'USDCAD': 0.0020   // 20 pips minimum
  };
  
  return minStopMapping[pair] || (symbol.includes('JPY') ? 0.25 : 0.0025);
}

function getMinimumTakeProfitDistance(symbol: string): number {
  // Minimum take profit distances in price units (should be larger than stops)
  const pair = symbol.replace('/', '');
  
  const minTPMapping: { [key: string]: number } = {
    'GBPUSD': 0.0040,  // 40 pips minimum
    'EURUSD': 0.0035,  // 35 pips minimum
    'USDCHF': 0.0035,  // 35 pips minimum
    'AUDUSD': 0.0040,  // 40 pips minimum
    'NZDUSD': 0.0045,  // 45 pips minimum
    'EURGBP': 0.0025,  // 25 pips minimum
    'EURJPY': 0.40,    // 40 pips minimum (JPY)
    'GBPJPY': 0.55,    // 55 pips minimum (JPY)
    'USDJPY': 0.35,    // 35 pips minimum (JPY)  
    'GBPAUD': 0.0045,  // 45 pips minimum
    'EURCAD': 0.0040,  // 40 pips minimum
    'USDCAD': 0.0035   // 35 pips minimum
  };
  
  return minTPMapping[pair] || (symbol.includes('JPY') ? 0.40 : 0.0040);
}
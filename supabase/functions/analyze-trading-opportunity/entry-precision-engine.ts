// Entry Price Precision Engine - Mathematically Consistent Entry Level Calculation

export interface TechnicalLevel {
  price: number;
  type: 'EMA' | 'SMA' | 'FIBONACCI' | 'SUPPORT' | 'RESISTANCE' | 'PIVOT' | 'BOLLINGER' | 'VWAP' | 'OPENING_RANGE' | 'SESSION_LEVEL';
  subtype: string;
  strength: number; // 0-100
  confluence: number; // Number of indicators supporting this level
  distanceFromCurrent: number; // In pips
  riskReward: number; // Expected R:R from this entry
}

export interface EntryOption {
  classification: 'IMMEDIATE' | 'PULLBACK' | 'STRATEGIC' | 'EXTREME';
  entryPrice: number;
  distanceInPips: number;
  confluence: number;
  riskReward: number;
  stopLoss: number;
  takeProfit: number;
  reasoning: string[];
  strength: number; // 0-100
  supportingLevels: TechnicalLevel[];
}

export interface EntryPrecisionAnalysis {
  currentPrice: number;
  symbol: string;
  pipValue: number;
  atr: number;
  buyOptions: EntryOption[];
  sellOptions: EntryOption[];
  recommendedBuyEntry: EntryOption | null;
  recommendedSellEntry: EntryOption | null;
  consistencyScore: number; // How consistent these levels are
  timeframe: string;
}

export function calculateOptimalEntryLevels(
  symbol: string,
  currentPrice: number,
  technicalAnalysis: any,
  enhancedFeatures: any,
  sessionContext: any,
  atr: number
): EntryPrecisionAnalysis {
  
  const pipValue = symbol.includes('JPY') ? 0.01 : 0.0001;
  
  // Extract all technical levels
  const technicalLevels = extractTechnicalLevels(
    currentPrice, 
    technicalAnalysis, 
    enhancedFeatures, 
    sessionContext, 
    pipValue,
    atr
  );
  
  // Generate entry options for both directions
  const buyOptions = generateEntryOptions('BUY', currentPrice, technicalLevels, atr, pipValue);
  const sellOptions = generateEntryOptions('SELL', currentPrice, technicalLevels, atr, pipValue);
  
  // Select recommended entries based on confluence and risk/reward
  const recommendedBuyEntry = selectBestEntry(buyOptions);
  const recommendedSellEntry = selectBestEntry(sellOptions);
  
  // Calculate consistency score
  const consistencyScore = calculateConsistencyScore(technicalLevels, currentPrice, atr);
  
  return {
    currentPrice,
    symbol,
    pipValue,
    atr,
    buyOptions: buyOptions.slice(0, 3), // Top 3 options
    sellOptions: sellOptions.slice(0, 3), // Top 3 options
    recommendedBuyEntry,
    recommendedSellEntry,
    consistencyScore,
    timeframe: '1H'
  };
}

function extractTechnicalLevels(
  currentPrice: number,
  ta: any,
  enhanced: any,
  session: any,
  pipValue: number,
  atr: number
): TechnicalLevel[] {
  const levels: TechnicalLevel[] = [];
  
  // EMA levels
  if (enhanced.ema20) {
    levels.push(createLevel(enhanced.ema20, 'EMA', 'EMA20', currentPrice, pipValue, 75));
  }
  if (enhanced.ema50) {
    levels.push(createLevel(enhanced.ema50, 'EMA', 'EMA50', currentPrice, pipValue, 80));
  }
  if (enhanced.ema100) {
    levels.push(createLevel(enhanced.ema100, 'EMA', 'EMA100', currentPrice, pipValue, 85));
  }
  
  // SMA levels
  if (ta.sma10) {
    levels.push(createLevel(ta.sma10, 'SMA', 'SMA10', currentPrice, pipValue, 70));
  }
  if (ta.sma20) {
    levels.push(createLevel(ta.sma20, 'SMA', 'SMA20', currentPrice, pipValue, 75));
  }
  
  // Fibonacci levels
  if (ta.fibonacci) {
    if (ta.fibonacci.level236) levels.push(createLevel(ta.fibonacci.level236, 'FIBONACCI', '23.6%', currentPrice, pipValue, 60));
    if (ta.fibonacci.level382) levels.push(createLevel(ta.fibonacci.level382, 'FIBONACCI', '38.2%', currentPrice, pipValue, 80));
    if (ta.fibonacci.level50) levels.push(createLevel(ta.fibonacci.level50, 'FIBONACCI', '50%', currentPrice, pipValue, 85));
    if (ta.fibonacci.level618) levels.push(createLevel(ta.fibonacci.level618, 'FIBONACCI', '61.8%', currentPrice, pipValue, 80));
    if (ta.fibonacci.level786) levels.push(createLevel(ta.fibonacci.level786, 'FIBONACCI', '78.6%', currentPrice, pipValue, 60));
  }
  
  // Support and Resistance
  if (ta.support) {
    levels.push(createLevel(ta.support, 'SUPPORT', 'Key Support', currentPrice, pipValue, 90));
  }
  if (ta.resistance) {
    levels.push(createLevel(ta.resistance, 'RESISTANCE', 'Key Resistance', currentPrice, pipValue, 90));
  }
  
  // Pivot Points
  if (ta.pivotPoints) {
    if (ta.pivotPoints.pivot) levels.push(createLevel(ta.pivotPoints.pivot, 'PIVOT', 'Daily Pivot', currentPrice, pipValue, 85));
    if (ta.pivotPoints.s1) levels.push(createLevel(ta.pivotPoints.s1, 'PIVOT', 'S1', currentPrice, pipValue, 75));
    if (ta.pivotPoints.s2) levels.push(createLevel(ta.pivotPoints.s2, 'PIVOT', 'S2', currentPrice, pipValue, 70));
    if (ta.pivotPoints.r1) levels.push(createLevel(ta.pivotPoints.r1, 'PIVOT', 'R1', currentPrice, pipValue, 75));
    if (ta.pivotPoints.r2) levels.push(createLevel(ta.pivotPoints.r2, 'PIVOT', 'R2', currentPrice, pipValue, 70));
  }
  
  // Bollinger Bands
  if (ta.bollinger) {
    if (ta.bollinger.upper) levels.push(createLevel(ta.bollinger.upper, 'BOLLINGER', 'Upper Band', currentPrice, pipValue, 70));
    if (ta.bollinger.middle) levels.push(createLevel(ta.bollinger.middle, 'BOLLINGER', 'Middle Band', currentPrice, pipValue, 75));
    if (ta.bollinger.lower) levels.push(createLevel(ta.bollinger.lower, 'BOLLINGER', 'Lower Band', currentPrice, pipValue, 70));
  }
  
  // VWAP
  if (enhanced.vwap) {
    levels.push(createLevel(enhanced.vwap, 'VWAP', 'Session VWAP', currentPrice, pipValue, 80));
  }
  
  // Opening Range levels
  if (enhanced.or60) {
    if (enhanced.or60.high) levels.push(createLevel(enhanced.or60.high, 'OPENING_RANGE', 'OR High', currentPrice, pipValue, 65));
    if (enhanced.or60.low) levels.push(createLevel(enhanced.or60.low, 'OPENING_RANGE', 'OR Low', currentPrice, pipValue, 65));
  }
  
  // Support/Resistance Zones from enhanced features
  if (enhanced.srZones && Array.isArray(enhanced.srZones)) {
    enhanced.srZones.slice(0, 5).forEach((zone: any, index: number) => {
      const midPrice = (zone.min + zone.max) / 2;
      const strength = Math.min(85, 50 + zone.strength * 2); // Convert zone strength to our scale
      levels.push(createLevel(midPrice, zone.type.toUpperCase(), `SR Zone ${index + 1}`, currentPrice, pipValue, strength));
    });
  }
  
  // Session-specific levels (previous day high/low, session open)
  const sessionHigh = session.high || currentPrice + (atr * 1.5);
  const sessionLow = session.low || currentPrice - (atr * 1.5);
  levels.push(createLevel(sessionHigh, 'SESSION_LEVEL', 'Session High', currentPrice, pipValue, 60));
  levels.push(createLevel(sessionLow, 'SESSION_LEVEL', 'Session Low', currentPrice, pipValue, 60));
  
  // Calculate confluence (how many levels are near each other)
  calculateConfluence(levels, pipValue * 5); // Within 5 pips
  
  return levels.filter(level => level.price > 0 && Math.abs(level.distanceFromCurrent) <= (atr * 5 / pipValue)); // Filter reasonable levels
}

function createLevel(
  price: number, 
  type: TechnicalLevel['type'], 
  subtype: string, 
  currentPrice: number, 
  pipValue: number, 
  baseStrength: number
): TechnicalLevel {
  const distanceFromCurrent = Math.abs(price - currentPrice) / pipValue;
  const decimals = pipValue === 0.01 ? 3 : 5; // JPY pairs use 3 decimals, others use 5
  
  return {
    price: Number(price.toFixed(decimals)),
    type,
    subtype,
    strength: baseStrength,
    confluence: 1, // Will be calculated later
    distanceFromCurrent: Math.round(distanceFromCurrent * 10) / 10,
    riskReward: 0 // Will be calculated when generating options
  };
}

function calculateConfluence(levels: TechnicalLevel[], confluenceDistance: number): void {
  levels.forEach(level => {
    level.confluence = levels.filter(other => 
      other !== level && Math.abs(other.price - level.price) <= confluenceDistance
    ).length + 1; // +1 to include itself
    
    // Boost strength based on confluence
    level.strength = Math.min(100, level.strength + (level.confluence - 1) * 10);
  });
}

function generateEntryOptions(
  direction: 'BUY' | 'SELL',
  currentPrice: number,
  levels: TechnicalLevel[],
  atr: number,
  pipValue: number
): EntryOption[] {
  const options: EntryOption[] = [];
  
  // Filter levels appropriate for direction
  const relevantLevels = direction === 'BUY' 
    ? levels.filter(l => l.price <= currentPrice + (atr * 0.5)) // Below or slightly above current
    : levels.filter(l => l.price >= currentPrice - (atr * 0.5)); // Above or slightly below current
  
  // Generate immediate entry (current price)
  const immediateEntry = generateImmediateEntry(direction, currentPrice, levels, atr, pipValue);
  if (immediateEntry) options.push(immediateEntry);
  
  // Generate pullback/strategic entries from relevant levels
  relevantLevels
    .filter(level => level.strength >= 60) // Only strong levels
    .sort((a, b) => b.strength - a.strength) // Sort by strength
    .slice(0, 8) // Top 8 levels
    .forEach(level => {
      const entryOption = generateEntryFromLevel(direction, level, levels, currentPrice, atr, pipValue);
      if (entryOption) options.push(entryOption);
    });
  
  // Sort by overall quality score
  return options
    .sort((a, b) => calculateQualityScore(b) - calculateQualityScore(a))
    .slice(0, 5); // Top 5 options
}

function generateImmediateEntry(
  direction: 'BUY' | 'SELL',
  currentPrice: number,
  levels: TechnicalLevel[],
  atr: number,
  pipValue: number
): EntryOption | null {
  
  const entryPrice = currentPrice;
  const distanceInPips = 0;
  
  // Find nearby levels for confluence
  const nearbyLevels = levels.filter(l => Math.abs(l.price - currentPrice) <= (3 * pipValue));
  const confluence = nearbyLevels.reduce((sum, l) => sum + l.confluence, 0);
  
  // Calculate stop loss and take profit
  const { stopLoss, takeProfit, riskReward } = calculateStopLossAndTakeProfit(
    direction, entryPrice, levels, atr, 'IMMEDIATE'
  );
  
  if (riskReward < 1.5) return null; // Skip if R:R too low
  
  return {
    classification: 'IMMEDIATE',
    entryPrice: Number(entryPrice.toFixed(currentPrice.toString().includes('.') ? 5 : 3)),
    distanceInPips,
    confluence: Math.max(1, confluence),
    riskReward: Number(riskReward.toFixed(2)),
    stopLoss: Number(stopLoss.toFixed(currentPrice.toString().includes('.') ? 5 : 3)),
    takeProfit: Number(takeProfit.toFixed(currentPrice.toString().includes('.') ? 5 : 3)),
    reasoning: ['Market entry at current price', `Confluence score: ${confluence}`, `R:R: ${riskReward.toFixed(2)}:1`],
    strength: Math.min(100, 40 + confluence * 10), // Base 40, +10 per confluence
    supportingLevels: nearbyLevels
  };
}

function generateEntryFromLevel(
  direction: 'BUY' | 'SELL',
  level: TechnicalLevel,
  allLevels: TechnicalLevel[],
  currentPrice: number,
  atr: number,
  pipValue: number
): EntryOption | null {
  
  const entryPrice = level.price;
  const distanceInPips = Math.abs(entryPrice - currentPrice) / pipValue;
  
  // Skip if too far from current price
  if (distanceInPips > (atr * 3 / pipValue)) return null;
  
  // Determine classification based on distance
  let classification: EntryOption['classification'];
  if (distanceInPips <= 3) classification = 'IMMEDIATE';
  else if (distanceInPips <= 15) classification = 'PULLBACK';
  else if (distanceInPips <= 40) classification = 'STRATEGIC';
  else classification = 'EXTREME';
  
  // Calculate stop loss and take profit
  const { stopLoss, takeProfit, riskReward } = calculateStopLossAndTakeProfit(
    direction, entryPrice, allLevels, atr, classification
  );
  
  if (riskReward < 1.5 || riskReward > 2.5) return null; // Skip if R:R outside acceptable range
  
  // Find supporting levels near this entry
  const supportingLevels = allLevels.filter(l => 
    l !== level && Math.abs(l.price - entryPrice) <= (5 * pipValue)
  );
  
  const reasoning = [
    `${direction} entry at ${level.type} ${level.subtype} (${entryPrice})`,
    `${distanceInPips.toFixed(1)} pips from current price`,
    `Confluence: ${level.confluence} levels`,
    `R:R: ${riskReward.toFixed(2)}:1`,
    `Level strength: ${level.strength}%`
  ];
  
  if (supportingLevels.length > 0) {
    reasoning.push(`Additional support from: ${supportingLevels.map(l => l.subtype).slice(0, 3).join(', ')}`);
  }
  
  return {
    classification,
    entryPrice: Number(entryPrice.toFixed(entryPrice.toString().includes('.') ? 5 : 3)),
    distanceInPips: Number(distanceInPips.toFixed(1)),
    confluence: level.confluence + supportingLevels.length,
    riskReward: Number(riskReward.toFixed(2)),
    stopLoss: Number(stopLoss.toFixed(entryPrice.toString().includes('.') ? 5 : 3)),
    takeProfit: Number(takeProfit.toFixed(entryPrice.toString().includes('.') ? 5 : 3)),
    reasoning,
    strength: Math.min(100, level.strength + supportingLevels.length * 5),
    supportingLevels: [level, ...supportingLevels]
  };
}

function calculateStopLossAndTakeProfit(
  direction: 'BUY' | 'SELL',
  entryPrice: number,
  levels: TechnicalLevel[],
  atr: number,
  classification: EntryOption['classification']
): { stopLoss: number; takeProfit: number; riskReward: number } {
  
  const buffer = atr * 0.2; // Minimum buffer beyond levels
  
  let stopLoss: number;
  let takeProfit: number;
  
  if (direction === 'BUY') {
    // Find nearest support below entry for stop loss
    const supportLevels = levels
      .filter(l => (l.type === 'SUPPORT' || l.type === 'PIVOT' || l.type === 'FIBONACCI') && l.price < entryPrice)
      .sort((a, b) => b.price - a.price); // Highest first
    
    stopLoss = supportLevels.length > 0 
      ? supportLevels[0].price - buffer
      : entryPrice - (atr * (classification === 'IMMEDIATE' ? 1.5 : 2.0));
    
    // Find nearest resistance above entry for take profit
    const resistanceLevels = levels
      .filter(l => (l.type === 'RESISTANCE' || l.type === 'PIVOT' || l.type === 'FIBONACCI') && l.price > entryPrice)
      .sort((a, b) => a.price - b.price); // Lowest first
    
    const risk = entryPrice - stopLoss;
    const targetRR = 2.0; // Target 2:1 R:R
    
    takeProfit = resistanceLevels.length > 0
      ? Math.min(resistanceLevels[0].price - buffer, entryPrice + (risk * targetRR))
      : entryPrice + (risk * targetRR);
      
  } else { // SELL
    // Find nearest resistance above entry for stop loss
    const resistanceLevels = levels
      .filter(l => (l.type === 'RESISTANCE' || l.type === 'PIVOT' || l.type === 'FIBONACCI') && l.price > entryPrice)
      .sort((a, b) => a.price - b.price); // Lowest first
    
    stopLoss = resistanceLevels.length > 0 
      ? resistanceLevels[0].price + buffer
      : entryPrice + (atr * (classification === 'IMMEDIATE' ? 1.5 : 2.0));
    
    // Find nearest support below entry for take profit
    const supportLevels = levels
      .filter(l => (l.type === 'SUPPORT' || l.type === 'PIVOT' || l.type === 'FIBONACCI') && l.price < entryPrice)
      .sort((a, b) => b.price - a.price); // Highest first
    
    const risk = stopLoss - entryPrice;
    const targetRR = 2.0; // Target 2:1 R:R
    
    takeProfit = supportLevels.length > 0
      ? Math.max(supportLevels[0].price + buffer, entryPrice - (risk * targetRR))
      : entryPrice - (risk * targetRR);
  }
  
  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(takeProfit - entryPrice);
  const riskReward = risk > 0 ? reward / risk : 0;
  
  return { stopLoss, takeProfit, riskReward };
}

function calculateQualityScore(option: EntryOption): number {
  let score = 0;
  
  // Base score from strength
  score += option.strength * 0.4;
  
  // Confluence bonus
  score += option.confluence * 5;
  
  // Risk/reward bonus (prefer 1.75-2.25 range)
  if (option.riskReward >= 1.75 && option.riskReward <= 2.25) {
    score += 20;
  } else if (option.riskReward >= 1.5 && option.riskReward <= 2.5) {
    score += 10;
  }
  
  // Distance penalty (prefer closer entries for liquidity)
  if (option.distanceInPips <= 5) score += 15;
  else if (option.distanceInPips <= 15) score += 10;
  else if (option.distanceInPips <= 30) score += 5;
  
  // Classification bonus
  switch (option.classification) {
    case 'PULLBACK': score += 10; break;
    case 'STRATEGIC': score += 5; break;
    case 'IMMEDIATE': score += 8; break;
    case 'EXTREME': score -= 5; break;
  }
  
  return score;
}

function selectBestEntry(options: EntryOption[]): EntryOption | null {
  if (options.length === 0) return null;
  
  // Apply additional selection criteria
  const qualifiedOptions = options.filter(option => 
    option.riskReward >= 1.5 && 
    option.riskReward <= 2.5 && 
    option.confluence >= 2 &&
    option.strength >= 50
  );
  
  if (qualifiedOptions.length === 0) return options[0]; // Fallback to highest scored
  
  return qualifiedOptions[0]; // Already sorted by quality score
}

function calculateConsistencyScore(levels: TechnicalLevel[], currentPrice: number, atr: number): number {
  // Measure how well-defined and clustered the technical levels are
  let score = 0;
  
  // Check level distribution
  const levelPrices = levels.map(l => l.price);
  const range = Math.max(...levelPrices) - Math.min(...levelPrices);
  const normalizedRange = range / (atr * 4); // Normalize by ATR
  
  // Prefer moderate range (not too tight, not too spread)
  if (normalizedRange >= 0.5 && normalizedRange <= 2.0) score += 30;
  else score += Math.max(0, 30 - Math.abs(normalizedRange - 1.25) * 10);
  
  // Check confluence quality
  const avgConfluence = levels.reduce((sum, l) => sum + l.confluence, 0) / levels.length;
  score += Math.min(30, avgConfluence * 10);
  
  // Check level strength distribution
  const strongLevels = levels.filter(l => l.strength >= 70).length;
  const totalLevels = levels.length;
  const strongRatio = strongLevels / totalLevels;
  score += strongRatio * 25;
  
  // Check for major level proximity to current price
  const majorLevelsNearby = levels.filter(l => 
    (l.type === 'SUPPORT' || l.type === 'RESISTANCE') && 
    Math.abs(l.price - currentPrice) <= atr
  ).length;
  score += Math.min(15, majorLevelsNearby * 5);
  
  return Math.round(Math.min(100, Math.max(0, score)));
}
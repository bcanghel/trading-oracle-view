// Entry Price Precision Engine - Simplified Working Version

export interface TechnicalLevel {
  price: number;
  type: 'EMA' | 'SMA' | 'SUPPORT' | 'RESISTANCE' | 'BOLLINGER' | 'SESSION_LEVEL';
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
  sessionContext: any = {},
  atr: number
): EntryPrecisionAnalysis {
  
  const pipValue = symbol.includes('JPY') ? 0.01 : 0.0001;
  
  // Safe defaults for missing data
  const safeTA = technicalAnalysis || {};
  const safeEnhanced = enhancedFeatures || {};
  
  // Extract basic technical levels
  const levels = extractBasicTechnicalLevels(safeTA, safeEnhanced, currentPrice, pipValue, atr);
  
  // Generate entry options for both directions
  const buyOptions = generateBasicEntryOptions('BUY', levels, currentPrice, atr, pipValue, symbol);
  const sellOptions = generateBasicEntryOptions('SELL', levels, currentPrice, atr, pipValue, symbol);
  
  // Find best options
  const recommendedBuyEntry = buyOptions.length > 0 ? buyOptions[0] : null;
  const recommendedSellEntry = sellOptions.length > 0 ? sellOptions[0] : null;
  
  // Calculate consistency score
  const consistencyScore = calculateBasicConsistencyScore(levels, buyOptions, sellOptions);
  
  return {
    currentPrice,
    symbol,
    pipValue,
    atr,
    buyOptions,
    sellOptions,
    recommendedBuyEntry,
    recommendedSellEntry,
    consistencyScore,
    timeframe: '1H+4H'
  };
}

function extractBasicTechnicalLevels(
  ta: any, 
  enhanced: any, 
  currentPrice: number, 
  pipValue: number, 
  atr: number
): TechnicalLevel[] {
  const levels: TechnicalLevel[] = [];
  
  // EMA levels (with null checks)
  if (enhanced.ema20) {
    levels.push(createLevel(enhanced.ema20, 'EMA', 'EMA20', currentPrice, pipValue, 75));
  }
  if (enhanced.ema50) {
    levels.push(createLevel(enhanced.ema50, 'EMA', 'EMA50', currentPrice, pipValue, 80));
  }
  
  // SMA levels
  if (ta.sma10) {
    levels.push(createLevel(ta.sma10, 'SMA', 'SMA10', currentPrice, pipValue, 70));
  }
  if (ta.sma20) {
    levels.push(createLevel(ta.sma20, 'SMA', 'SMA20', currentPrice, pipValue, 75));
  }
  
  // Support and Resistance (always include fallback levels)
  const support = ta.support || currentPrice - (atr * 1.5);
  const resistance = ta.resistance || currentPrice + (atr * 1.5);
  
  levels.push(createLevel(support, 'SUPPORT', 'Key Support', currentPrice, pipValue, 90));
  levels.push(createLevel(resistance, 'RESISTANCE', 'Key Resistance', currentPrice, pipValue, 90));
  
  // Bollinger Bands
  if (ta.bollinger) {
    if (ta.bollinger.upper) levels.push(createLevel(ta.bollinger.upper, 'BOLLINGER', 'Upper Band', currentPrice, pipValue, 70));
    if (ta.bollinger.middle) levels.push(createLevel(ta.bollinger.middle, 'BOLLINGER', 'Middle Band', currentPrice, pipValue, 75));
    if (ta.bollinger.lower) levels.push(createLevel(ta.bollinger.lower, 'BOLLINGER', 'Lower Band', currentPrice, pipValue, 70));
  }
  
  // Session levels
  const sessionHigh = currentPrice + (atr * 1.2);
  const sessionLow = currentPrice - (atr * 1.2);
  levels.push(createLevel(sessionHigh, 'SESSION_LEVEL', 'Session High', currentPrice, pipValue, 60));
  levels.push(createLevel(sessionLow, 'SESSION_LEVEL', 'Session Low', currentPrice, pipValue, 60));
  
  // Calculate confluence
  calculateConfluence(levels, pipValue * 5);
  
  // Filter reasonable levels
  return levels.filter(level => level.price > 0 && Math.abs(level.distanceFromCurrent) <= (atr * 3 / pipValue));
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
  const decimals = pipValue === 0.01 ? 3 : 5;
  
  return {
    price: Number(price.toFixed(decimals)),
    type,
    subtype,
    strength: baseStrength,
    confluence: 1,
    distanceFromCurrent: Math.round(distanceFromCurrent * 10) / 10,
    riskReward: 0
  };
}

function calculateConfluence(levels: TechnicalLevel[], pipDistance: number): void {
  for (let i = 0; i < levels.length; i++) {
    let confluence = 1;
    for (let j = 0; j < levels.length; j++) {
      if (i !== j && Math.abs(levels[i].price - levels[j].price) <= pipDistance) {
        confluence++;
      }
    }
    levels[i].confluence = confluence;
  }
}

function generateBasicEntryOptions(
  direction: 'BUY' | 'SELL',
  levels: TechnicalLevel[],
  currentPrice: number,
  atr: number,
  pipValue: number,
  symbol: string
): EntryOption[] {
  const options: EntryOption[] = [];
  const isLong = direction === 'BUY';
  
  // Immediate entry (market order) with proper minimum distances
  const immediateEntry = currentPrice;
  const minStopDistance = getMinimumStopDistance(symbol);
  const minTakeProfitDistance = getMinimumTakeProfitDistance(symbol);
  
  const immediateStopLoss = isLong ? 
    currentPrice - Math.max(atr * 0.8, minStopDistance) : 
    currentPrice + Math.max(atr * 0.8, minStopDistance);
    
  const immediateTakeProfit = isLong ? 
    currentPrice + Math.max(atr * 1.6, minTakeProfitDistance) : 
    currentPrice - Math.max(atr * 1.6, minTakeProfitDistance);
  
  options.push({
    classification: 'IMMEDIATE',
    entryPrice: immediateEntry,
    distanceInPips: 0,
    confluence: 1,
    riskReward: 2.0,
    stopLoss: immediateStopLoss,
    takeProfit: immediateTakeProfit,
    reasoning: ['Market entry at current price'],
    strength: 60,
    supportingLevels: []
  });
  
  // Find relevant levels for pullback entries
  const relevantLevels = levels.filter(level => {
    const distance = Math.abs(level.price - currentPrice) / pipValue;
    return distance >= 5 && distance <= 50 && level.strength >= 70;
  });
  
  // Generate pullback options
  relevantLevels.slice(0, 3).forEach((level, index) => {
    const classification = level.distanceFromCurrent <= 15 ? 'PULLBACK' : 
                         level.distanceFromCurrent <= 30 ? 'STRATEGIC' : 'EXTREME';
    
    const entryPrice = level.price;
    const minStopDistance = getMinimumStopDistance(symbol);
    const minTakeProfitDistance = getMinimumTakeProfitDistance(symbol);
    
    const stopLoss = isLong ? 
      entryPrice - Math.max(atr * 0.6, minStopDistance) : 
      entryPrice + Math.max(atr * 0.6, minStopDistance);
      
    const takeProfit = isLong ? 
      entryPrice + Math.max(atr * 1.5, minTakeProfitDistance) : 
      entryPrice - Math.max(atr * 1.5, minTakeProfitDistance);
    
    options.push({
      classification,
      entryPrice,
      distanceInPips: level.distanceFromCurrent,
      confluence: level.confluence,
      riskReward: Math.abs(takeProfit - entryPrice) / Math.abs(entryPrice - stopLoss),
      stopLoss,
      takeProfit,
      reasoning: [`Entry at ${level.subtype} level`, `Confluence: ${level.confluence}`],
      strength: level.strength,
      supportingLevels: [level]
    });
  });
  
  // Sort by strength and confluence
  return options.sort((a, b) => (b.strength + b.confluence * 10) - (a.strength + a.confluence * 10));
}

function calculateBasicConsistencyScore(
  levels: TechnicalLevel[],
  buyOptions: EntryOption[],
  sellOptions: EntryOption[]
): number {
  let score = 50; // Base score
  
  // Add points for level confluence
  const avgConfluence = levels.length > 0 ? levels.reduce((sum, level) => sum + level.confluence, 0) / levels.length : 1;
  score += Math.min(30, avgConfluence * 5);
  
  // Add points for having good entry options
  if (buyOptions.length > 1) score += 10;
  if (sellOptions.length > 1) score += 10;
  
  // Add points for high-strength levels
  const highStrengthLevels = levels.filter(level => level.strength >= 80).length;
  score += Math.min(20, highStrengthLevels * 5);
  
  return Math.min(100, Math.max(20, Math.round(score)));
}

// Helper functions for realistic pip distances (same as deterministic engine)
function getMinimumStopDistance(symbol: string): number {
  const pair = symbol.replace('/', '');
  const minStopMapping: { [key: string]: number } = {
    'GBPUSD': 0.0025, 'EURUSD': 0.0020, 'USDCHF': 0.0020, 'AUDUSD': 0.0025,
    'NZDUSD': 0.0030, 'EURGBP': 0.0015, 'EURJPY': 0.25, 'GBPJPY': 0.35,
    'USDJPY': 0.20, 'GBPAUD': 0.0030, 'EURCAD': 0.0025, 'USDCAD': 0.0020
  };
  return minStopMapping[pair] || (symbol.includes('JPY') ? 0.25 : 0.0025);
}

function getMinimumTakeProfitDistance(symbol: string): number {
  const pair = symbol.replace('/', '');
  const minTPMapping: { [key: string]: number } = {
    'GBPUSD': 0.0040, 'EURUSD': 0.0035, 'USDCHF': 0.0035, 'AUDUSD': 0.0040,
    'NZDUSD': 0.0045, 'EURGBP': 0.0025, 'EURJPY': 0.40, 'GBPJPY': 0.55,
    'USDJPY': 0.35, 'GBPAUD': 0.0045, 'EURCAD': 0.0040, 'USDCAD': 0.0035
  };
  return minTPMapping[pair] || (symbol.includes('JPY') ? 0.40 : 0.0040);
}
// Enhanced Technical Indicators with ADR, VWAP, Confluence Scoring, and Support/Resistance Zones

export interface EnhancedFeatures {
  // Daily context (1D)
  adr20: number;
  adrUsedToday: number; // Percentage
  dailyBias: number; // -1, 0, +1
  
  // 1H primary features
  ema20: number;
  ema50: number;
  ema100: number;
  ema20Slope: number;
  ema50Slope: number;
  ema100Slope: number;
  distToEMA100: number; // in basis points
  
  // Volatility features
  atr14: number;
  atr20: number;
  bbandWidth: number;
  keltnerWidth: number;
  squeeze: boolean; // BB inside Keltner
  
  // Structure features
  donchianPosition: number; // 0..1
  hhFlag: boolean; // Higher high (20-period)
  llFlag: boolean; // Lower low (20-period)
  candleBodyRatio: number;
  
  // VWAP (session anchored)
  vwap: number;
  distanceToVWAP: number; // in basis points
  
  // Opening Range
  or60: { high: number; low: number; state: 'inside' | 'break' | 'retest' };
  
  // Activity/Spread proxies
  zTR20: number;
  zAbsRet20: number;
  activityScore: number;
  spreadZ: number;
  
  // 4H filters
  bias4h: number; // -1..+1
  vol4h: 'low' | 'medium' | 'high';
  
  // Support/Resistance Zones
  srZones: Array<{
    min: number;
    max: number;
    touchCount: number;
    strength: number;
    type: 'support' | 'resistance';
  }>;
  distanceToSRZone: number;
  inSRZone: boolean;
  nearestZoneStrength: number;
  
  // Confluence Score (0-100)
  confluenceScore: number;
}

export function calculateEnhancedIndicators(
  data1h: any[], 
  data4h: any[] | null, 
  data1d: any[] | null,
  currentPrice: number,
  symbol: string,
  sessionContext: any
): EnhancedFeatures {
  
  if (!data1h || data1h.length < 100) {
    // Return default values if insufficient data
    return createDefaultFeatures(currentPrice);
  }
  
  const closes1h = data1h.map(d => parseFloat(d.close));
  const highs1h = data1h.map(d => parseFloat(d.high));
  const lows1h = data1h.map(d => parseFloat(d.low));
  const volumes1h = data1h.map(d => d.volume || 0);
  
  // === DAILY CONTEXT (1D) ===
  let adr20 = 0, adrUsedToday = 0, dailyBias = 0;
  if (data1d && data1d.length >= 20) {
    const dailyRanges = data1d.slice(-20).map(d => parseFloat(d.high) - parseFloat(d.low));
    adr20 = dailyRanges.reduce((a, b) => a + b, 0) / 20;
    
    // Today's range usage
    const todayHigh = Math.max(...highs1h.slice(-24)); // Last 24 hours
    const todayLow = Math.min(...lows1h.slice(-24));
    adrUsedToday = ((todayHigh - todayLow) / adr20) * 100;
    
    // Daily bias from 1D SMA20 slope
    if (data1d.length >= 25) {
      const closes1d = data1d.map(d => parseFloat(d.close));
      const sma20_1d = closes1d.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const sma20_1d_5ago = closes1d.slice(-25, -5).reduce((a, b) => a + b, 0) / 20;
      const slope = (sma20_1d - sma20_1d_5ago) / sma20_1d_5ago;
      dailyBias = slope > 0.001 ? 1 : slope < -0.001 ? -1 : 0;
    }
  }
  
  // === 1H PRIMARY FEATURES ===
  // EMA calculations
  const ema20 = calculateEMA(closes1h, 20);
  const ema50 = calculateEMA(closes1h, 50);
  const ema100 = calculateEMA(closes1h, 100);
  
  // EMA slopes (5-period change)
  const ema20Slope = ema20.length >= 5 ? (ema20[ema20.length - 1] - ema20[ema20.length - 5]) / ema20[ema20.length - 5] : 0;
  const ema50Slope = ema50.length >= 5 ? (ema50[ema50.length - 1] - ema50[ema50.length - 5]) / ema50[ema50.length - 5] : 0;
  const ema100Slope = ema100.length >= 5 ? (ema100[ema100.length - 1] - ema100[ema100.length - 5]) / ema100[ema100.length - 5] : 0;
  
  // Distance to EMA100 in basis points
  const distToEMA100 = ema100.length > 0 ? ((currentPrice - ema100[ema100.length - 1]) / ema100[ema100.length - 1]) * 10000 : 0;
  
  // === VOLATILITY FEATURES ===
  const atr14 = calculateATR(data1h, 14);
  const atr20 = calculateATR(data1h, 20);
  
  // Bollinger Bands
  const bb20 = calculateBollingerBands(closes1h, 20, 2);
  const bbandWidth = bb20.upper > 0 ? ((bb20.upper - bb20.lower) / bb20.middle) * 100 : 0;
  
  // Keltner Channels
  const keltner20 = calculateKeltnerChannels(data1h, 20, 1.5);
  const keltnerWidth = keltner20.upper > 0 ? ((keltner20.upper - keltner20.lower) / keltner20.middle) * 100 : 0;
  
  // Squeeze detection (BB inside Keltner)
  const squeeze = bb20.upper > 0 && keltner20.upper > 0 && bb20.upper < keltner20.upper && bb20.lower > keltner20.lower;
  
  // === STRUCTURE FEATURES ===
  // Donchian Channel position
  const donchian20 = calculateDonchianChannels(highs1h, lows1h, 20);
  const donchianPosition = donchian20.range > 0 ? (currentPrice - donchian20.lower) / donchian20.range : 0.5;
  
  // Higher High / Lower Low flags
  const hhFlag = highs1h.length >= 20 && currentPrice > Math.max(...highs1h.slice(-20, -1));
  const llFlag = lows1h.length >= 20 && currentPrice < Math.min(...lows1h.slice(-20, -1));
  
  // Candle body ratio
  const lastCandle = data1h[data1h.length - 1];
  const bodySize = Math.abs(parseFloat(lastCandle.close) - parseFloat(lastCandle.open));
  const totalRange = parseFloat(lastCandle.high) - parseFloat(lastCandle.low);
  const candleBodyRatio = totalRange > 0 ? bodySize / totalRange : 0;
  
  // === VWAP (Session anchored) ===
  const vwapResult = calculateSessionVWAP(data1h, sessionContext);
  const distanceToVWAP = vwapResult.vwap > 0 ? ((currentPrice - vwapResult.vwap) / vwapResult.vwap) * 10000 : 0;
  
  // === OPENING RANGE ===
  const or60 = calculateOpeningRange(data1h, sessionContext);
  
  // === ACTIVITY/SPREAD PROXIES ===
  const trueRanges = data1h.slice(-20).map((candle, i) => {
    const high = parseFloat(candle.high);
    const low = parseFloat(candle.low);
    const prevClose = i > 0 ? parseFloat(data1h[data1h.length - 20 + i - 1].close) : parseFloat(candle.close);
    return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  });
  
  const meanTR = trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;
  const stdTR = Math.sqrt(trueRanges.reduce((sum, tr) => sum + Math.pow(tr - meanTR, 2), 0) / trueRanges.length);
  const currentTR = trueRanges[trueRanges.length - 1];
  const zTR20 = stdTR > 0 ? (currentTR - meanTR) / stdTR : 0;
  
  // Z-score for absolute returns
  const absReturns = closes1h.slice(-20).map((close, i) => {
    if (i === 0) return 0;
    return Math.abs(close - closes1h[closes1h.length - 20 + i - 1]) / closes1h[closes1h.length - 20 + i - 1];
  });
  const meanAbsRet = absReturns.reduce((a, b) => a + b, 0) / absReturns.length;
  const stdAbsRet = Math.sqrt(absReturns.reduce((sum, ret) => sum + Math.pow(ret - meanAbsRet, 2), 0) / absReturns.length);
  const currentAbsRet = absReturns[absReturns.length - 1];
  const zAbsRet20 = stdAbsRet > 0 ? (currentAbsRet - meanAbsRet) / stdAbsRet : 0;
  
  const activityScore = zTR20 + zAbsRet20;
  
  // Spread Z-score (synthetic)
  const spreadZ = Math.random() * 2 - 1; // Placeholder - replace with actual spread data if available
  
  // === 4H FILTERS ===
  let bias4h = 0;
  let vol4h: 'low' | 'medium' | 'high' = 'medium';
  
  if (data4h && data4h.length >= 50) {
    const closes4h = data4h.map(d => parseFloat(d.close));
    const ema20_4h = calculateEMA(closes4h, 20);
    const ema50_4h = calculateEMA(closes4h, 50);
    
    // 4H bias from EMA slope and position
    const ema20Slope4h = ema20_4h.length >= 5 ? (ema20_4h[ema20_4h.length - 1] - ema20_4h[ema20_4h.length - 5]) / ema20_4h[ema20_4h.length - 5] : 0;
    const priceVsEma50 = ema50_4h.length > 0 ? (currentPrice - ema50_4h[ema50_4h.length - 1]) / ema50_4h[ema50_4h.length - 1] : 0;
    
    bias4h = Math.max(-1, Math.min(1, ema20Slope4h * 100 + priceVsEma50 * 50));
    
    // 4H volatility bucket
    const atr20_4h = calculateATR(data4h, 20);
    const atrPercentile = calculatePercentile(data4h.slice(-84).map(() => atr20_4h), atr20_4h);
    vol4h = atrPercentile < 0.33 ? 'low' : atrPercentile > 0.66 ? 'high' : 'medium';
  }
  
  // === SUPPORT/RESISTANCE ZONES ===
  const srZones = calculateSRZones(data1h, adr20, symbol);
  const { distanceToSRZone, inSRZone, nearestZoneStrength } = findNearestZone(srZones, currentPrice);
  
  // === CONFLUENCE SCORE (0-100) ===
  const confluenceScore = calculateConfluenceScore({
    ema20Slope, ema50Slope, ema100Slope, distToEMA100, bias4h, vol4h,
    bbandWidth, keltnerWidth, squeeze, distanceToSRZone, adrUsedToday,
    distanceToVWAP, sessionContext, currentPrice, or60
  });
  
  return {
    adr20, adrUsedToday, dailyBias,
    ema20: ema20[ema20.length - 1] || currentPrice,
    ema50: ema50[ema50.length - 1] || currentPrice,
    ema100: ema100[ema100.length - 1] || currentPrice,
    ema20Slope, ema50Slope, ema100Slope, distToEMA100,
    atr14, atr20, bbandWidth, keltnerWidth, squeeze,
    donchianPosition, hhFlag, llFlag, candleBodyRatio,
    vwap: vwapResult.vwap, distanceToVWAP,
    or60, zTR20, zAbsRet20, activityScore, spreadZ,
    bias4h, vol4h, srZones, distanceToSRZone, inSRZone, nearestZoneStrength,
    confluenceScore
  };
}

// === HELPER FUNCTIONS ===

function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length < period) return [];
  const k = 2 / (period + 1);
  const ema = [prices[period - 1]]; // Start with SMA
  
  for (let i = period; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[ema.length - 1] * (1 - k));
  }
  return ema;
}

function calculateATR(data: any[], period: number): number {
  if (data.length < period + 1) return 0;
  
  const trs = [];
  for (let i = 1; i < data.length; i++) {
    const high = parseFloat(data[i].high);
    const low = parseFloat(data[i].low);
    const prevClose = parseFloat(data[i - 1].close);
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trs.push(tr);
  }
  
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calculateBollingerBands(closes: number[], period: number, stdDev: number) {
  if (closes.length < period) return { upper: 0, middle: 0, lower: 0 };
  
  const recentCloses = closes.slice(-period);
  const middle = recentCloses.reduce((a, b) => a + b, 0) / period;
  const variance = recentCloses.reduce((sum, close) => sum + Math.pow(close - middle, 2), 0) / period;
  const std = Math.sqrt(variance);
  
  return {
    upper: middle + (std * stdDev),
    middle,
    lower: middle - (std * stdDev)
  };
}

function calculateKeltnerChannels(data: any[], period: number, atrMultiplier: number) {
  if (data.length < period) return { upper: 0, middle: 0, lower: 0 };
  
  const closes = data.map(d => parseFloat(d.close));
  const middle = closes.slice(-period).reduce((a, b) => a + b, 0) / period;
  const atr = calculateATR(data, period);
  
  return {
    upper: middle + (atr * atrMultiplier),
    middle,
    lower: middle - (atr * atrMultiplier)
  };
}

function calculateDonchianChannels(highs: number[], lows: number[], period: number) {
  if (highs.length < period || lows.length < period) return { upper: 0, lower: 0, range: 0 };
  
  const recentHighs = highs.slice(-period);
  const recentLows = lows.slice(-period);
  const upper = Math.max(...recentHighs);
  const lower = Math.min(...recentLows);
  
  return { upper, lower, range: upper - lower };
}

function calculateSessionVWAP(data: any[], sessionContext: any) {
  // Simplified VWAP calculation anchored at NY 17:00 daily reset
  // In a real implementation, this would track from the session start
  const recentData = data.slice(-24); // Last 24 hours as proxy
  let totalVolume = 0;
  let totalVolumePrice = 0;
  
  recentData.forEach(candle => {
    const typical = (parseFloat(candle.high) + parseFloat(candle.low) + parseFloat(candle.close)) / 3;
    const volume = candle.volume || 1000; // Default volume if missing
    totalVolumePrice += typical * volume;
    totalVolume += volume;
  });
  
  return { vwap: totalVolume > 0 ? totalVolumePrice / totalVolume : 0 };
}

function calculateOpeningRange(data: any[], sessionContext: any) {
  // Simplified OR60 - first hour of NY session
  // In reality, this would track from actual session start
  const recentCandles = data.slice(-6); // Approximate first 6 candles of session
  
  if (recentCandles.length === 0) {
    return { high: 0, low: 0, state: 'inside' as const };
  }
  
  const orHigh = Math.max(...recentCandles.map(c => parseFloat(c.high)));
  const orLow = Math.min(...recentCandles.map(c => parseFloat(c.low)));
  
  const currentPrice = parseFloat(data[data.length - 1].close);
  let state: 'inside' | 'break' | 'retest' = 'inside';
  
  if (currentPrice > orHigh || currentPrice < orLow) {
    state = 'break';
  }
  
  return { high: orHigh, low: orLow, state };
}

function calculateSRZones(data: any[], adr20: number, symbol: string) {
  // Detect swing highs/lows using fractals
  const swings = detectSwingPoints(data, 2); // k=2 each side
  const swingPrices = swings.slice(-80); // Last 80 swings
  
  if (swingPrices.length === 0) return [];
  
  // Determine pip value for binning
  const pipValue = symbol.includes('JPY') ? 0.01 : 0.0001;
  const binWidth = Math.max((0.25 * adr20) / pipValue, 1) * pipValue;
  
  // Bin the swing prices
  const bins = new Map<number, { prices: number[], count: number }>();
  
  swingPrices.forEach(price => {
    const binKey = Math.round(price / binWidth) * binWidth;
    if (!bins.has(binKey)) {
      bins.set(binKey, { prices: [], count: 0 });
    }
    bins.get(binKey)!.prices.push(price);
    bins.get(binKey)!.count++;
  });
  
  // Create zones from bins with >= 2 touches
  const zones = Array.from(bins.entries())
    .filter(([_, bin]) => bin.count >= 2)
    .map(([binKey, bin]) => {
      const minPrice = Math.min(...bin.prices);
      const maxPrice = Math.max(...bin.prices);
      const touchCount = bin.count;
      
      return {
        min: minPrice,
        max: maxPrice,
        touchCount,
        strength: calculateZoneStrength(touchCount, bin.prices),
        type: Math.random() > 0.5 ? 'support' : 'resistance' as 'support' | 'resistance' // Simplified
      };
    })
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 10); // Keep top 10 zones
  
  return zones;
}

function detectSwingPoints(data: any[], k: number): number[] {
  const swings: number[] = [];
  
  for (let i = k; i < data.length - k; i++) {
    const current = parseFloat(data[i].high);
    const isSwingHigh = data.slice(i - k, i).every(d => parseFloat(d.high) < current) &&
                       data.slice(i + 1, i + k + 1).every(d => parseFloat(d.high) < current);
    
    if (isSwingHigh) {
      swings.push(current);
    }
    
    const currentLow = parseFloat(data[i].low);
    const isSwingLow = data.slice(i - k, i).every(d => parseFloat(d.low) > currentLow) &&
                      data.slice(i + 1, i + k + 1).every(d => parseFloat(d.low) > currentLow);
    
    if (isSwingLow) {
      swings.push(currentLow);
    }
  }
  
  return swings;
}

function calculateZoneStrength(touchCount: number, prices: number[]): number {
  // Simple strength calculation based on touch count and recency
  const recencyBonus = 1; // Simplified - in reality, weight recent touches more
  return touchCount * 10 + recencyBonus;
}

function findNearestZone(zones: any[], currentPrice: number) {
  if (zones.length === 0) {
    return { distanceToSRZone: Infinity, inSRZone: false, nearestZoneStrength: 0 };
  }
  
  let minDistance = Infinity;
  let inZone = false;
  let nearestStrength = 0;
  
  zones.forEach(zone => {
    if (currentPrice >= zone.min && currentPrice <= zone.max) {
      inZone = true;
      minDistance = 0;
      nearestStrength = Math.max(nearestStrength, zone.strength);
    } else {
      const distanceToZone = Math.min(
        Math.abs(currentPrice - zone.min),
        Math.abs(currentPrice - zone.max)
      );
      if (distanceToZone < minDistance) {
        minDistance = distanceToZone;
        nearestStrength = zone.strength;
      }
    }
  });
  
  return {
    distanceToSRZone: minDistance,
    inSRZone: inZone,
    nearestZoneStrength: nearestStrength
  };
}

function calculatePercentile(values: number[], target: number): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const index = sorted.findIndex(v => v >= target);
  return index === -1 ? 1 : index / sorted.length;
}

function calculateConfluenceScore(params: {
  ema20Slope: number; ema50Slope: number; ema100Slope: number;
  distToEMA100: number; bias4h: number; vol4h: string;
  bbandWidth: number; keltnerWidth: number; squeeze: boolean;
  distanceToSRZone: number; adrUsedToday: number; distanceToVWAP: number;
  sessionContext: any; currentPrice: number; or60: any;
}): number {
  let score = 0;
  
  // Trend alignment (30 pts)
  const isBullishTrend = params.ema20Slope > 0 && params.distToEMA100 > 0;
  const isBearishTrend = params.ema20Slope < 0 && params.distToEMA100 < 0;
  if (isBullishTrend || isBearishTrend) score += 15;
  
  // 4H agreement (15 pts)
  const trendAgreement = (isBullishTrend && params.bias4h > 0) || (isBearishTrend && params.bias4h < 0);
  if (trendAgreement) score += 15;
  
  // Volatility state (15 pts)
  if (params.vol4h === 'medium') score += 15;
  else if (params.vol4h === 'high' && params.squeeze) score += 10; // Squeeze breakout setup
  else if (params.vol4h === 'low') score += 5;
  
  // S/R spacing (20 pts) 
  const atrProxy = 0.0001; // Simplified ATR for spacing check
  if (params.distanceToSRZone > 0.25 * atrProxy) score += 20; // Good spacing for trend
  else if (params.distanceToSRZone <= 0.15 * atrProxy) score += 15; // Good for mean reversion
  
  // Squeeze/Expansion (15 pts)
  if (params.squeeze && Math.abs(params.distanceToVWAP) < 20) score += 15; // Near VWAP + squeeze
  
  // ADR guard (10 pts) - penalize if too much range used
  if (params.adrUsedToday <= 80) score += 10;
  else score -= 10;
  
  // Session/VWAP (10 pts)
  const isGoodSession = params.sessionContext.session === 'London' || params.sessionContext.session === 'Overlap';
  const rightSideOfVWAP = params.distanceToVWAP > 0; // Simplified direction check
  if (isGoodSession && rightSideOfVWAP) score += 10;
  
  return Math.max(0, Math.min(100, score));
}

function createDefaultFeatures(currentPrice: number): EnhancedFeatures {
  return {
    adr20: 0, adrUsedToday: 0, dailyBias: 0,
    ema20: currentPrice, ema50: currentPrice, ema100: currentPrice,
    ema20Slope: 0, ema50Slope: 0, ema100Slope: 0, distToEMA100: 0,
    atr14: 0, atr20: 0, bbandWidth: 0, keltnerWidth: 0, squeeze: false,
    donchianPosition: 0.5, hhFlag: false, llFlag: false, candleBodyRatio: 0.5,
    vwap: currentPrice, distanceToVWAP: 0,
    or60: { high: currentPrice, low: currentPrice, state: 'inside' },
    zTR20: 0, zAbsRet20: 0, activityScore: 0, spreadZ: 0,
    bias4h: 0, vol4h: 'medium',
    srZones: [], distanceToSRZone: Infinity, inSRZone: false, nearestZoneStrength: 0,
    confluenceScore: 50
  };
}
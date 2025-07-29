export function calculateTechnicalIndicators(data: any[]) {
  if (!data || data.length < 26) { // Increased minimum length for accurate MACD
    return {
      sma10: 0,
      sma20: 0,
      rsi: 50,
      support: 0,
      resistance: 0,
      priceRange: { high: 0, low: 0 },
      atr: 0,
      macd: { macd: 0, signal: 0, histogram: 0 },
      bollinger: { upper: 0, middle: 0, lower: 0 },
      pivotPoints: { pivot: 0, r1: 0, r2: 0, s1: 0, s2: 0 },
      fibonacci: { level236: 0, level382: 0, level500: 0, level618: 0, level786: 0 },
      swingLevels: { swingHigh: 0, swingLow: 0 },
      volatility: { bbandWidth: 0, atrPercentage: 0, status: 'LOW' },
      confidenceScore: 50
    };
  }

  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const volumes = data.map(d => d.volume || 0);
  const currentPrice = closes[closes.length - 1];

  // Simple Moving Averages
  const sma10 = closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;

  // IMPROVEMENT: Using standard RSI calculation with Wilder's Smoothing (via EMA)
  const rsi = calculateRSI(closes, 14);

  // IMPROVEMENT: Using standard ATR calculation
  const atr = calculateATR(data, 14);

  // IMPROVEMENT: Using standard MACD calculation with proper EMA signal line
  const macd = calculateMACD(closes, 12, 26, 9);

  // Bollinger Bands
  const bollinger = calculateBollingerBands(closes, 20, 2);

  // Pivot Points (daily)
  const pivotPoints = calculatePivotPoints(data);

  // Fibonacci Retracements
  const fibonacci = calculateFibonacci(highs, lows);

  // Swing High/Low Detection
  const swingLevels = calculateSwingLevels(data.slice(-20));

  // Support and Resistance using a blend of swing levels and pivots
  const support = Math.min(swingLevels.swingLow, pivotPoints.s1);
  const resistance = Math.max(swingLevels.swingHigh, pivotPoints.r1);

  // IMPROVEMENT: Added a dedicated volatility analysis object
  const bbandWidth = bollinger.upper > 0 ? ((bollinger.upper - bollinger.lower) / bollinger.middle) * 100 : 0;
  const atrPercentage = (atr / currentPrice) * 100;
  let volatilityStatus = 'LOW';
  if (atrPercentage > 0.3) volatilityStatus = 'MODERATE';
  if (atrPercentage > 0.6) volatilityStatus = 'HIGH';

  // Algorithmic Confidence Score
  const confidenceScore = calculateConfidenceScore({
    rsi, sma10, sma20, atr, macd, bollinger, support, resistance, currentPrice,
    volume: volumes[volumes.length - 1],
    avgVolume: volumes.slice(-10).reduce((a, b) => a + b, 0) / 10
  });

  return {
    sma10: parseFloat(sma10.toFixed(5)),
    sma20: parseFloat(sma20.toFixed(5)),
    rsi: parseFloat(rsi.toFixed(2)),
    support: parseFloat(support.toFixed(5)),
    resistance: parseFloat(resistance.toFixed(5)),
    priceRange: { high: Math.max(...highs.slice(-24)), low: Math.min(...lows.slice(-24)) },
    atr: parseFloat(atr.toFixed(5)),
    macd,
    bollinger,
    pivotPoints,
    fibonacci,
    swingLevels,
    volatility: { 
        bbandWidth: parseFloat(bbandWidth.toFixed(2)), 
        atrPercentage: parseFloat(atrPercentage.toFixed(2)),
        status: volatilityStatus 
    },
    confidenceScore: Math.round(confidenceScore)
  };
}

// IMPROVEMENT: Proper EMA calculation for use in other indicators
function calculateEMA(prices: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const emaArray = [prices[0]];
    for (let i = 1; i < prices.length; i++) {
        emaArray.push(prices[i] * k + emaArray[i - 1] * (1 - k));
    }
    return emaArray;
}

// IMPROVEMENT: Standard RSI calculation using Wilder's smoothing method (EMA on gains/losses)
export function calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length <= period) return 50;
    
    let gains = [];
    let losses = [];
    for (let i = 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? -change : 0);
    }

    const avgGain = calculateEMA(gains, period).slice(-1)[0];
    const avgLoss = calculateEMA(losses, period).slice(-1)[0];

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return parseFloat((100 - (100 / (1 + rs))).toFixed(2));
}

// IMPROVEMENT: Standard ATR calculation using Wilder's smoothing
export function calculateATR(data: any[], period: number = 14): number {
    if (data.length <= period) return 0;
    const trueRanges: number[] = [];
    for (let i = 1; i < data.length; i++) {
        const tr1 = data[i].high - data[i].low;
        const tr2 = Math.abs(data[i].high - data[i - 1].close);
        const tr3 = Math.abs(data[i].low - data[i - 1].close);
        trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    // Wilder's smoothing (EMA) of the true ranges
    const atr = calculateEMA(trueRanges, period).pop() || 0;
    return atr;
}

// IMPROVEMENT: Standard MACD calculation with a true EMA signal line
export function calculateMACD(prices: number[], fastPeriod: number, slowPeriod: number, signalPeriod: number): { macd: number, signal: number, histogram: number } {
    if (prices.length < slowPeriod) return { macd: 0, signal: 0, histogram: 0 };

    const emaFast = calculateEMA(prices, fastPeriod);
    const emaSlow = calculateEMA(prices, slowPeriod);
    
    const macdLine = emaFast.map((val, index) => val - emaSlow[index]);
    const signalLine = calculateEMA(macdLine, signalPeriod);
    
    const macd = macdLine.pop() || 0;
    const signal = signalLine.pop() || 0;
    const histogram = macd - signal;

    return {
        macd: parseFloat(macd.toFixed(5)),
        signal: parseFloat(signal.toFixed(5)),
        histogram: parseFloat(histogram.toFixed(5))
    };
}

export function calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2): { upper: number, middle: number, lower: number } {
    if (prices.length < period) return { upper: 0, middle: 0, lower: 0 };
    const middle = prices.slice(-period).reduce((a, b) => a + b, 0) / period;
    const variance = prices.slice(-period).reduce((a, b) => a + Math.pow(b - middle, 2), 0) / period;
    const std = Math.sqrt(variance);
    return {
        upper: parseFloat((middle + (std * stdDev)).toFixed(5)),
        middle: parseFloat(middle.toFixed(5)),
        lower: parseFloat((middle - (std * stdDev)).toFixed(5))
    };
}

export function calculatePivotPoints(data: any[]): { pivot: number, r1: number, r2: number, s1: number, s2: number } {
    if (data.length < 1) return { pivot: 0, r1: 0, r2: 0, s1: 0, s2: 0 };
    const last = data[data.length - 1];
    const pivot = (last.high + last.low + last.close) / 3;
    return {
        pivot: parseFloat(pivot.toFixed(5)),
        r1: parseFloat(((2 * pivot) - last.low).toFixed(5)),
        s1: parseFloat(((2 * pivot) - last.high).toFixed(5)),
        r2: parseFloat((pivot + (last.high - last.low)).toFixed(5)),
        s2: parseFloat((pivot - (last.high - last.low)).toFixed(5))
    };
}

export function calculateFibonacci(highs: number[], lows: number[]): { level236: number, level382: number, level500: number, level618: number, level786: number } {
    if (highs.length < 20) return { level236: 0, level382: 0, level500: 0, level618: 0, level786: 0 };
    const high = Math.max(...highs.slice(-20));
    const low = Math.min(...lows.slice(-20));
    const range = high - low;
    return {
        level236: parseFloat((high - range * 0.236).toFixed(5)),
        level382: parseFloat((high - range * 0.382).toFixed(5)),
        level500: parseFloat((high - range * 0.500).toFixed(5)),
        level618: parseFloat((high - range * 0.618).toFixed(5)),
        level786: parseFloat((high - range * 0.786).toFixed(5))
    };
}

export function calculateSwingLevels(data: any[]): { swingHigh: number, swingLow: number } {
    if (data.length < 5) return { swingHigh: 0, swingLow: 0 };
    let swingHigh = 0, swingLow = Infinity;
    for (let i = 2; i < data.length - 2; i++) {
        if (data[i].high > data[i - 1].high && data[i].high > data[i - 2].high && data[i].high > data[i + 1].high && data[i].high > data[i + 2].high) swingHigh = Math.max(swingHigh, data[i].high);
        if (data[i].low < data[i - 1].low && data[i].low < data[i - 2].low && data[i].low < data[i + 1].low && data[i].low < data[i + 2].low) swingLow = Math.min(swingLow, data[i].low);
    }
    if (swingHigh === 0) swingHigh = Math.max(...data.map(d => d.high));
    if (swingLow === Infinity) swingLow = Math.min(...data.map(d => d.low));
    return { swingHigh: parseFloat(swingHigh.toFixed(5)), swingLow: parseFloat(swingLow.toFixed(5)) };
}

export function calculateConfidenceScore(indicators: any): number {
    // This function can be further refined, but for now remains as a weighted scoring model.
    // The accuracy of its inputs is now much higher.
    let score = 0, maxScore = 0;
    maxScore += 20; if (indicators.rsi < 30 || indicators.rsi > 70) score += 15; else if (indicators.rsi >= 40 && indicators.rsi <= 60) score += 10; else score += 5;
    maxScore += 15; if (indicators.sma10 > indicators.sma20) score += 10; if (Math.abs(indicators.currentPrice - indicators.sma10) / indicators.currentPrice < 0.002) score += 5;
    maxScore += 15; const srRange = indicators.resistance - indicators.support; if (srRange > 0) { const pricePos = (indicators.currentPrice - indicators.support) / srRange; if (pricePos > 0.1 && pricePos < 0.9) score += 10; if (srRange / indicators.currentPrice > 0.01) score += 5; }
    maxScore += 10; if (Math.abs(indicators.macd.histogram) > Math.abs(indicators.macd.macd) * 0.1) score += 8; else score += 4;
    maxScore += 10; const atrPercent = indicators.atr / indicators.currentPrice; if (atrPercent > 0.005 && atrPercent < 0.02) score += 8; else if (atrPercent >= 0.002) score += 5; else score += 2;
    maxScore += 15; const volRatio = indicators.volume / indicators.avgVolume; if (volRatio > 1.2) score += 12; else if (volRatio > 0.8) score += 8; else score += 4;
    maxScore += 15; const bbRange = indicators.bollinger.upper - indicators.bollinger.lower; if (bbRange > 0) { const bbPos = (indicators.currentPrice - indicators.bollinger.lower) / bbRange; if (bbPos < 0.2 || bbPos > 0.8) score += 12; else if (bbPos >= 0.4 && bbPos <= 0.6) score += 8; else score += 6; }
    return Math.min(100, Math.max(0, (score / maxScore) * 100));
}
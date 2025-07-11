export function calculateTechnicalIndicators(data: any[]) {
  if (!data || data.length < 20) {
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
      confidenceScore: 50
    };
  }

  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const volumes = data.map(d => d.volume || 0);

  // Simple Moving Averages
  const sma10 = closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;

  // RSI calculation (14 periods)
  const rsi = calculateRSI(closes.slice(-15), 14);

  // ATR calculation
  const atr = calculateATR(data.slice(-14));

  // MACD calculation
  const macd = calculateMACD(closes);

  // Bollinger Bands
  const bollinger = calculateBollingerBands(closes.slice(-20));

  // Pivot Points (daily)
  const pivotPoints = calculatePivotPoints(data);

  // Fibonacci Retracements
  const fibonacci = calculateFibonacci(highs, lows);

  // Swing High/Low Detection
  const swingLevels = calculateSwingLevels(data.slice(-20));

  // Support and Resistance using swing levels
  const support = Math.min(swingLevels.swingLow, pivotPoints.s1);
  const resistance = Math.max(swingLevels.swingHigh, pivotPoints.r1);

  // Algorithmic Confidence Score
  const confidenceScore = calculateConfidenceScore({
    rsi,
    sma10,
    sma20,
    atr,
    macd,
    bollinger,
    support,
    resistance,
    currentPrice: closes[closes.length - 1],
    volume: volumes[volumes.length - 1],
    avgVolume: volumes.slice(-10).reduce((a, b) => a + b, 0) / 10
  });

  return {
    sma10: parseFloat(sma10.toFixed(5)),
    sma20: parseFloat(sma20.toFixed(5)),
    rsi: parseFloat(rsi.toFixed(2)),
    support: parseFloat(support.toFixed(5)),
    resistance: parseFloat(resistance.toFixed(5)),
    priceRange: {
      high: Math.max(...highs.slice(-24)),
      low: Math.min(...lows.slice(-24))
    },
    atr: parseFloat(atr.toFixed(5)),
    macd,
    bollinger,
    pivotPoints,
    fibonacci,
    swingLevels,
    confidenceScore: Math.round(confidenceScore)
  };
}

export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i < period + 1; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return rsi;
}

// ATR (Average True Range) calculation
export function calculateATR(data: any[], period: number = 14): number {
  if (data.length < period) return 0;

  const trueRanges = [];
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;
    
    const tr1 = high - low;
    const tr2 = Math.abs(high - prevClose);
    const tr3 = Math.abs(low - prevClose);
    
    trueRanges.push(Math.max(tr1, tr2, tr3));
  }

  return trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
}

// MACD calculation
export function calculateMACD(prices: number[]): { macd: number, signal: number, histogram: number } {
  if (prices.length < 26) return { macd: 0, signal: 0, histogram: 0 };

  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macd = ema12 - ema26;
  
  // For signal line, we need MACD history, simplified here
  const signal = macd * 0.15; // Simplified calculation
  const histogram = macd - signal;

  return {
    macd: parseFloat(macd.toFixed(5)),
    signal: parseFloat(signal.toFixed(5)),
    histogram: parseFloat(histogram.toFixed(5))
  };
}

// EMA calculation helper
function calculateEMA(prices: number[], period: number): number {
  const multiplier = 2 / (period + 1);
  let ema = prices[0];
  
  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
  }
  
  return ema;
}

// Bollinger Bands calculation
export function calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2): { upper: number, middle: number, lower: number } {
  if (prices.length < period) return { upper: 0, middle: 0, lower: 0 };

  const sma = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / prices.length;
  const std = Math.sqrt(variance);

  return {
    upper: parseFloat((sma + (std * stdDev)).toFixed(5)),
    middle: parseFloat(sma.toFixed(5)),
    lower: parseFloat((sma - (std * stdDev)).toFixed(5))
  };
}

// Pivot Points calculation
export function calculatePivotPoints(data: any[]): { pivot: number, r1: number, r2: number, s1: number, s2: number } {
  if (data.length < 1) return { pivot: 0, r1: 0, r2: 0, s1: 0, s2: 0 };

  // Use last candle for pivot calculation
  const lastCandle = data[data.length - 1];
  const high = lastCandle.high;
  const low = lastCandle.low;
  const close = lastCandle.close;

  const pivot = (high + low + close) / 3;
  const r1 = (2 * pivot) - low;
  const s1 = (2 * pivot) - high;
  const r2 = pivot + (high - low);
  const s2 = pivot - (high - low);

  return {
    pivot: parseFloat(pivot.toFixed(5)),
    r1: parseFloat(r1.toFixed(5)),
    r2: parseFloat(r2.toFixed(5)),
    s1: parseFloat(s1.toFixed(5)),
    s2: parseFloat(s2.toFixed(5))
  };
}

// Fibonacci Retracements calculation
export function calculateFibonacci(highs: number[], lows: number[]): { level236: number, level382: number, level500: number, level618: number, level786: number } {
  if (highs.length < 20 || lows.length < 20) {
    return { level236: 0, level382: 0, level500: 0, level618: 0, level786: 0 };
  }

  const swingHigh = Math.max(...highs.slice(-20));
  const swingLow = Math.min(...lows.slice(-20));
  const range = swingHigh - swingLow;

  return {
    level236: parseFloat((swingHigh - (range * 0.236)).toFixed(5)),
    level382: parseFloat((swingHigh - (range * 0.382)).toFixed(5)),
    level500: parseFloat((swingHigh - (range * 0.500)).toFixed(5)),
    level618: parseFloat((swingHigh - (range * 0.618)).toFixed(5)),
    level786: parseFloat((swingHigh - (range * 0.786)).toFixed(5))
  };
}

// Swing High/Low Detection
export function calculateSwingLevels(data: any[]): { swingHigh: number, swingLow: number } {
  if (data.length < 5) return { swingHigh: 0, swingLow: 0 };

  let swingHigh = 0;
  let swingLow = Infinity;

  // Look for swing highs and lows using 3-period pivot detection
  for (let i = 2; i < data.length - 2; i++) {
    const current = data[i];
    const prev1 = data[i - 1];
    const prev2 = data[i - 2];
    const next1 = data[i + 1];
    const next2 = data[i + 2];

    // Swing High: current high is higher than 2 periods before and after
    if (current.high > prev1.high && current.high > prev2.high && 
        current.high > next1.high && current.high > next2.high) {
      swingHigh = Math.max(swingHigh, current.high);
    }

    // Swing Low: current low is lower than 2 periods before and after
    if (current.low < prev1.low && current.low < prev2.low && 
        current.low < next1.low && current.low < next2.low) {
      swingLow = Math.min(swingLow, current.low);
    }
  }

  // Fallback to recent highs/lows if no swing points found
  if (swingHigh === 0) swingHigh = Math.max(...data.map(d => d.high));
  if (swingLow === Infinity) swingLow = Math.min(...data.map(d => d.low));

  return {
    swingHigh: parseFloat(swingHigh.toFixed(5)),
    swingLow: parseFloat(swingLow.toFixed(5))
  };
}

// Algorithmic Confidence Score Calculation
export function calculateConfidenceScore(indicators: any): number {
  let score = 0;
  let maxScore = 0;

  // RSI Signal Strength (0-20 points)
  maxScore += 20;
  if (indicators.rsi < 30) score += 15; // Oversold - good for buy
  else if (indicators.rsi > 70) score += 15; // Overbought - good for sell
  else if (indicators.rsi >= 40 && indicators.rsi <= 60) score += 10; // Neutral zone
  else score += 5;

  // Moving Average Alignment (0-15 points)
  maxScore += 15;
  const priceToSMA10 = Math.abs(indicators.currentPrice - indicators.sma10) / indicators.currentPrice;
  const priceToSMA20 = Math.abs(indicators.currentPrice - indicators.sma20) / indicators.currentPrice;
  
  if (indicators.sma10 > indicators.sma20) score += 10; // Bullish alignment
  if (priceToSMA10 < 0.002) score += 5; // Price near SMA10

  // Support/Resistance Quality (0-15 points)
  maxScore += 15;
  const srRange = indicators.resistance - indicators.support;
  const pricePosition = (indicators.currentPrice - indicators.support) / srRange;
  
  if (pricePosition > 0.1 && pricePosition < 0.9) score += 10; // Price between S/R
  if (srRange / indicators.currentPrice > 0.01) score += 5; // Good S/R spread

  // MACD Signal Strength (0-10 points)
  maxScore += 10;
  if (Math.abs(indicators.macd.histogram) > Math.abs(indicators.macd.macd) * 0.1) {
    score += 8; // Strong momentum
  } else {
    score += 4;
  }

  // ATR Volatility Assessment (0-10 points)
  maxScore += 10;
  const atrPercent = indicators.atr / indicators.currentPrice;
  if (atrPercent > 0.005 && atrPercent < 0.02) score += 8; // Good volatility
  else if (atrPercent >= 0.002) score += 5; // Acceptable volatility
  else score += 2; // Low volatility

  // Volume Confirmation (0-15 points)
  maxScore += 15;
  const volumeRatio = indicators.volume / indicators.avgVolume;
  if (volumeRatio > 1.2) score += 12; // High volume
  else if (volumeRatio > 0.8) score += 8; // Normal volume
  else score += 4; // Low volume

  // Bollinger Band Position (0-15 points)
  maxScore += 15;
  const bbRange = indicators.bollinger.upper - indicators.bollinger.lower;
  const bbPosition = (indicators.currentPrice - indicators.bollinger.lower) / bbRange;
  
  if (bbPosition < 0.2 || bbPosition > 0.8) score += 12; // Near bands - reversal potential
  else if (bbPosition >= 0.4 && bbPosition <= 0.6) score += 8; // Middle range
  else score += 6;

  // Convert to 0-100 scale
  return Math.min(100, Math.max(0, (score / maxScore) * 100));
}
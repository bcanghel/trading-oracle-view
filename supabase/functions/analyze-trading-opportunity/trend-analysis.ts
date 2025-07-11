export function analyzeTrend(data: any[]) {
  if (!data || data.length < 12) {
    return {
      overallTrend: 'NEUTRAL',
      trendStrength: 'WEAK',
      momentum: 'NEUTRAL',
      higherHighs: false,
      higherLows: false,
      candlePatterns: 'None detected',
      volumeTrend: 'NEUTRAL'
    };
  }

  const recentCandles = data.slice(-24); // Last 24 hours
  const closes = recentCandles.map(d => d.close);
  const highs = recentCandles.map(d => d.high);
  const lows = recentCandles.map(d => d.low);
  const volumes = recentCandles.map(d => d.volume || 0);

  // Trend direction based on price movement
  const firstClose = closes[0];
  const lastClose = closes[closes.length - 1];
  const priceChange = ((lastClose - firstClose) / firstClose) * 100;

  // Calculate momentum using recent 6 candles vs previous 6
  const recentCloses = closes.slice(-6);
  const previousCloses = closes.slice(-12, -6);
  const recentAvg = recentCloses.reduce((a, b) => a + b, 0) / recentCloses.length;
  const previousAvg = previousCloses.reduce((a, b) => a + b, 0) / previousCloses.length;
  const momentum = ((recentAvg - previousAvg) / previousAvg) * 100;

  // Check for higher highs and higher lows (bullish pattern)
  const midPoint = Math.floor(highs.length / 2);
  const firstHalfHighs = highs.slice(0, midPoint);
  const secondHalfHighs = highs.slice(midPoint);
  const firstHalfLows = lows.slice(0, midPoint);
  const secondHalfLows = lows.slice(midPoint);

  const maxFirstHigh = Math.max(...firstHalfHighs);
  const maxSecondHigh = Math.max(...secondHalfHighs);
  const minFirstLow = Math.min(...firstHalfLows);
  const minSecondLow = Math.min(...secondHalfLows);

  const higherHighs = maxSecondHigh > maxFirstHigh;
  const higherLows = minSecondLow > minFirstLow;

  // Simple candle pattern detection
  const lastThreeCandles = recentCandles.slice(-3);
  let candlePatterns = 'None detected';
  
  if (lastThreeCandles.length >= 3) {
    const bullishCandles = lastThreeCandles.filter(c => c.close > c.open).length;
    const bearishCandles = lastThreeCandles.filter(c => c.close < c.open).length;
    
    if (bullishCandles === 3) {
      candlePatterns = 'Three White Soldiers (Bullish)';
    } else if (bearishCandles === 3) {
      candlePatterns = 'Three Black Crows (Bearish)';
    } else if (bullishCandles >= 2) {
      candlePatterns = 'Bullish momentum';
    } else if (bearishCandles >= 2) {
      candlePatterns = 'Bearish momentum';
    }
  }

  // Volume trend analysis
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const recentVolume = volumes.slice(-6).reduce((a, b) => a + b, 0) / 6;
  let volumeTrend = 'NEUTRAL';
  
  if (recentVolume > avgVolume * 1.2) {
    volumeTrend = 'INCREASING';
  } else if (recentVolume < avgVolume * 0.8) {
    volumeTrend = 'DECREASING';
  }

  // Overall trend determination
  let overallTrend = 'NEUTRAL';
  if (priceChange > 0.1 && momentum > 0) {
    overallTrend = 'BULLISH';
  } else if (priceChange < -0.1 && momentum < 0) {
    overallTrend = 'BEARISH';
  }

  // Trend strength
  let trendStrength = 'WEAK';
  const absChange = Math.abs(priceChange);
  if (absChange > 0.5) {
    trendStrength = 'STRONG';
  } else if (absChange > 0.2) {
    trendStrength = 'MODERATE';
  }

  return {
    overallTrend,
    trendStrength,
    momentum: momentum > 0.05 ? 'BULLISH' : momentum < -0.05 ? 'BEARISH' : 'NEUTRAL',
    higherHighs,
    higherLows,
    candlePatterns,
    volumeTrend
  };
}
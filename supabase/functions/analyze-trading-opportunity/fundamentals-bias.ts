import { FundamentalsInput, FundamentalBias } from "./fundamentals-types.ts";

export function computeFundamentalBias(fundamentals: FundamentalsInput): FundamentalBias {
  const { baseCcy, quoteCcy, releases } = fundamentals;
  
  // Only process USD-related pairs
  if (baseCcy !== "USD" && quoteCcy !== "USD") {
    return {
      overallBias: "NEUTRAL",
      strength: 0,
      summary: "No USD fundamentals analysis for non-USD pairs",
      keyEvents: []
    };
  }

  const usdReleases = releases.filter(r => r.currency === "USD");
  if (usdReleases.length === 0) {
    return {
      overallBias: "NEUTRAL",
      strength: 0,
      summary: "No recent USD economic data available",
      keyEvents: []
    };
  }

  let bullishScore = 0;
  let bearishScore = 0;
  const keyEvents: string[] = [];

  // Analyze each USD economic release
  for (const release of usdReleases) {
    const { event, actual, forecast, previous } = release;
    const beatForecast = forecast !== null ? actual > forecast : false;
    const beatPrevious = previous !== null ? actual > previous : false;

    // Weight different events
    let weight = 1;
    if (["CPI", "Core CPI", "PCE"].includes(event)) weight = 3; // Inflation data
    if (["NFP", "Unemployment"].includes(event)) weight = 3; // Employment data
    if (["Rate Decision"].includes(event)) weight = 4; // Fed decisions
    if (["GDP"].includes(event)) weight = 2.5; // Growth data
    if (["PMI Manufacturing", "PMI Services"].includes(event)) weight = 2; // Sentiment

    // Determine if the result is USD bullish or bearish
    let eventBias = 0;
    
    switch (event) {
      case "CPI":
      case "Core CPI":
      case "PCE":
        // Higher inflation can be USD bullish (hawkish Fed) if not too high
        if (actual > 2.5 && actual < 4.0) {
          eventBias = beatForecast ? 1 : (beatPrevious ? 0.5 : 0);
        } else if (actual > 4.0) {
          eventBias = beatForecast ? -0.5 : -1; // Too high inflation is bad
        } else {
          eventBias = beatForecast ? -0.5 : -1; // Too low inflation is dovish
        }
        break;

      case "NFP":
        // Strong employment is USD bullish
        eventBias = beatForecast ? 1 : (beatPrevious ? 0.5 : -0.5);
        break;

      case "Unemployment":
        // Lower unemployment is USD bullish
        eventBias = beatForecast ? -1 : (beatPrevious ? -0.5 : 0.5);
        break;

      case "Jobless Claims":
        // Lower claims are USD bullish
        eventBias = beatForecast ? -1 : (beatPrevious ? -0.5 : 0.5);
        break;

      case "GDP":
        // Higher GDP growth is USD bullish
        eventBias = beatForecast ? 1 : (beatPrevious ? 0.5 : -0.5);
        break;

      case "PMI Manufacturing":
      case "PMI Services":
        // Above 50 and beating estimates is bullish
        if (actual > 50) {
          eventBias = beatForecast ? 1 : (beatPrevious ? 0.5 : 0);
        } else {
          eventBias = beatForecast ? -0.5 : -1;
        }
        break;

      case "Retail Sales":
        // Higher retail sales are USD bullish
        eventBias = beatForecast ? 1 : (beatPrevious ? 0.5 : -0.5);
        break;

      case "Rate Decision":
        // This needs context - for now, assume higher rates are bullish
        eventBias = beatForecast ? 1 : (beatPrevious ? 0.5 : -0.5);
        break;

      default:
        eventBias = 0;
    }

    const weightedBias = eventBias * weight;
    if (weightedBias > 0) {
      bullishScore += weightedBias;
    } else if (weightedBias < 0) {
      bearishScore += Math.abs(weightedBias);
    }

    // Add to key events if significant
    if (Math.abs(eventBias) >= 0.5) {
      const direction = eventBias > 0 ? "👍" : "👎";
      keyEvents.push(`${direction} ${event}: ${actual}${forecast ? ` vs ${forecast}f` : ""}${previous ? ` (prev: ${previous})` : ""}`);
    }
  }

  // Calculate overall bias
  const totalScore = bullishScore + bearishScore;
  const netScore = bullishScore - bearishScore;
  const strength = totalScore > 0 ? Math.min(100, Math.abs(netScore) / totalScore * 100) : 0;

  let overallBias: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
  if (strength > 30) {
    if (netScore > 0) {
      overallBias = "BULLISH";
    } else {
      overallBias = "BEARISH";
    }
  }

  // Adjust bias direction based on pair structure
  let finalBias = overallBias;
  if (quoteCcy === "USD" && overallBias !== "NEUTRAL") {
    // For XXX/USD pairs, USD strength means pair goes down
    finalBias = overallBias === "BULLISH" ? "BEARISH" : "BULLISH";
  }

  const summary = `USD fundamentals show ${overallBias.toLowerCase()} bias (${Math.round(strength)}% strength) based on ${usdReleases.length} recent events. ${keyEvents.length > 0 ? "Key drivers: " + keyEvents.slice(0, 3).join(", ") : ""}`;

  return {
    overallBias: finalBias,
    strength: Math.round(strength),
    summary,
    keyEvents: keyEvents.slice(0, 5) // Top 5 events
  };
}
/* eslint-disable max-params */

// Confidence scoring module (session/news agnostic)
// We ignore news and current session effects; assume user enters at optimal session.

export type Side = "BUY" | "SELL";
export type Session = "Asia" | "London" | "NY" | "Overlap";

export interface PriceMeta {
  symbol: string;
  currentPrice: number;
  volumeType?: "synthetic" | "real";
}

export interface TAJson {
  atr: number;
  rsi: number;
  macd: { macd: number; signal: number; histogram: number };
  sma10: number;
  sma20: number;
  bollinger: { lower: number; upper: number; middle: number };
  resistance?: number;
  support?: number;
  volatility?: { status?: string; bbandWidth?: number; atrPercentage?: number };
  confidenceScore?: number;
  enhancedFeatures: {
    ema20: number;
    ema50: number;
    ema100: number;
    ema20Slope?: number;
    ema50Slope?: number;
    ema100Slope?: number;
    squeeze?: boolean;
    bias4h?: number;
    adr20?: number;
    adrUsedToday?: number;
    donchianPosition?: number;
    srZones?: Array<{
      max: number;
      min: number;
      type: "support" | "resistance";
      strength: number;
      touchCount?: number;
    }>;
  };
}

export interface SignalContext {
  side: Side;
  entry: number;
  sl: number;
  session: Session; // ignored in scoring (assume optimal)
  redNewsSoon: boolean; // ignored in scoring
  adrUsedRatio?: number;
}

interface ScoringInputs {
  side: Side;
  price: number;
  entry: number;
  sl: number;
  atr: number;
  atrPct: number;
  rsi: number;
  macdHist: number;
  ema20: number; ema50: number; ema100: number;
  ema20Slope: number; ema50Slope: number;
  bbLower: number; bbUpper: number; bbWidthPct: number;
  bias4h: number;
  squeeze: boolean;
  adrUsed: number;
  session: Session; // present for compatibility; not used
  redNewsSoon: boolean; // present for compatibility; not used
  zoneType: "support" | "resistance" | "none";
  zoneStrength: number;
  zoneMid: number;
  entryDistATR: number;
  volumeType: "synthetic" | "real";
  algoConfidence01?: number;
}

export interface DeterministicResult {
  confidence_conditional: number; // 0..1
  p_fill: number; // 0..1
  headline_confidence: number; // 0..1
  telemetry: Record<string, any>;
}

export interface AIRequestPayload {
  side: Side;
  price: number;
  entry: number;
  sl: number;
  atr: number;
  atrPct: number;
  rsi: number;
  macdHist: number;
  ema20: number;
  ema50: number;
  ema100: number;
  ema20Slope: number;
  ema50Slope: number;
  bbLower: number;
  bbUpper: number;
  bbWidthPct: number;
  bias4h: number;
  squeeze: boolean;
  adrUsed: number;
  session: Session;
  redNewsSoon: boolean;
  zone: { type: "support" | "resistance" | "none"; strength: number; mid: number };
  entryDistATR: number;
  base_confidence_conditional: number;
  p_fill: number;
}

export interface AIResponse {
  ai_confidence_conditional: number; // 0..1
  delta_confidence: number; // -0.15..+0.15
  delta_p_fill?: number; // -0.20..+0.20
  direction_agree: boolean;
  reasons: string[];
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function bandScore(x: number, mid: number, halfWidth: number) {
  const t = Math.abs(x - mid) / Math.max(halfWidth, 1e-9);
  return clamp01(1 - t);
}

function gaussianScore(x: number, pref: number, width: number) {
  const z = (x - pref) / Math.max(width, 1e-9);
  return Math.exp(-z * z);
}

function toConfidence01(blend01: number) {
  return lerp(0.25, 0.85, clamp01(blend01));
}

function fillProbability(entryDistATR: number) {
  const p = Math.exp(-entryDistATR / 0.6);
  return clamp01(p);
}

function pickZoneForEntry(
  side: Side,
  entry: number,
  zones: NonNullable<TAJson["enhancedFeatures"]["srZones"]>
): { type: "support" | "resistance" | "none"; strength: number; mid: number } {
  if (!zones || zones.length === 0) return { type: "none", strength: 0, mid: entry };
  const wanted = side === "BUY" ? "support" : "resistance";
  const candidates = zones.filter((z) => z.type === wanted);
  const pool = candidates.length ? candidates : zones;

  let best = pool[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const z of pool) {
    const mid = (z.max + z.min) / 2;
    const dist = Math.abs(mid - entry);
    if (dist < bestDist) { best = z; bestDist = dist; }
  }
  return { type: best.type, strength: best.strength ?? 50, mid: (best.max + best.min) / 2 };
}

export function toScoringInputs(
  priceMeta: PriceMeta,
  ta: TAJson,
  ctx: SignalContext
): ScoringInputs {
  const price = priceMeta.currentPrice;
  const atr = ta.atr;
  const atrPct = ta.volatility?.atrPercentage ?? (atr / price) * 100;
  const macdHist = ta.macd?.histogram ?? 0;
  const bbLower = ta.bollinger.lower;
  const bbUpper = ta.bollinger.upper;
  const bbWidthPct = ta.volatility?.bbandWidth ?? Math.abs((bbUpper - bbLower) / Math.max(ta.bollinger.middle, 1e-9)) * 100;
  const bias4h = ta.enhancedFeatures.bias4h ?? 0;
  const squeeze = !!ta.enhancedFeatures.squeeze;
  const volumeType = priceMeta.volumeType ?? "synthetic";

  let adrUsed = typeof ctx.adrUsedRatio === "number"
    ? clamp01(ctx.adrUsedRatio)
    : (() => {
        const used = ta.enhancedFeatures.adrUsedToday;
        if (typeof used === "number") return clamp01(used > 1 ? used / 100 : used);
        const pos = clamp01(ta.enhancedFeatures.donchianPosition ?? 0.5);
        return Math.max(pos, 1 - pos);
      })();

  const picked = pickZoneForEntry(ctx.side, ctx.entry, ta.enhancedFeatures.srZones ?? [] as any);
  const entryDistATR = Math.abs(ctx.entry - price) / Math.max(atr, 1e-9);

  const algoConfidence01 = typeof ta.confidenceScore === "number"
    ? toConfidence01(clamp01(ta.confidenceScore / 100))
    : undefined;

  return {
    side: ctx.side,
    price,
    entry: ctx.entry,
    sl: ctx.sl,
    atr,
    atrPct,
    rsi: ta.rsi,
    macdHist,
    ema20: ta.enhancedFeatures.ema20,
    ema50: ta.enhancedFeatures.ema50,
    ema100: ta.enhancedFeatures.ema100,
    ema20Slope: ta.enhancedFeatures.ema20Slope ?? 0,
    ema50Slope: ta.enhancedFeatures.ema50Slope ?? 0,
    bbLower, bbUpper, bbWidthPct,
    bias4h, squeeze,
    adrUsed,
    session: ctx.session,
    redNewsSoon: ctx.redNewsSoon,
    zoneType: picked.type,
    zoneStrength: picked.strength,
    zoneMid: picked.mid,
    entryDistATR,
    volumeType,
    algoConfidence01,
  };
}

export function deterministicConfidence(i: ScoringInputs): DeterministicResult {
  const trendBuy = (i.price > i.ema20 && i.ema20 > i.ema50 && i.ema50 > i.ema100 ? 1 : 0)
    * (i.ema20Slope > 0 && i.ema50Slope > 0 ? 1 : 0.8);
  const trendSell = (i.price < i.ema20 && i.ema20 < i.ema50 && i.ema50 < i.ema100 ? 1 : 0)
    * (i.ema20Slope < 0 && i.ema50Slope < 0 ? 1 : 0.8);
  const trend = (i.side === "BUY" ? trendBuy : trendSell);

  const rsiTarget = (i.side === "BUY" ? 62 : 38);
  const rsiScore = bandScore(i.rsi, rsiTarget, 20);

  const macdRaw = Math.tanh((i.macdHist || 0) * 150);
  const macdScore = i.side === "BUY" ? clamp01(0.5 + 0.5 * macdRaw) : clamp01(0.5 - 0.5 * macdRaw);

  const volScore = gaussianScore(i.atrPct, 0.18, 0.10);

  const bbPos = (i.price - i.bbLower) / Math.max(1e-9, i.bbUpper - i.bbLower);
  const bbScore = i.side === "BUY"
    ? (1 - Math.abs(bbPos - 0.35) / 0.35)
    : (1 - Math.abs(bbPos - 0.65) / 0.35);
  const bbScore01 = clamp01(bbScore);

  const distToZoneATR = Math.abs(i.entry - i.zoneMid) / Math.max(i.atr, 1e-9);
  let srScore = 0.5;
  if (i.zoneType !== "none") {
    const sideOK = (i.side === "BUY" && i.zoneType === "support") || (i.side === "SELL" && i.zoneType === "resistance");
    const nearOK = distToZoneATR <= 0.4 ? 1 : distToZoneATR <= 0.7 ? 0.7 : 0.4;
    srScore = (sideOK ? 0.6 : 0.4) + 0.4 * (i.zoneStrength / 100) * nearOK;
    srScore = clamp01(srScore);
  }

  const biasScore = clamp01(0.5 + 0.5 * Math.tanh((i.bias4h || 0) * 2));
  const mtfScore = (i.side === "BUY") ? biasScore : (1 - biasScore);

  const w = { trend: 0.26, rsi: 0.22, sr: 0.18, macd: 0.14, bb: 0.12, vol: 0.08 } as const;
  const baseBlend =
    w.trend * trend +
    w.rsi * rsiScore +
    w.sr * srScore +
    w.macd * macdScore +
    w.bb * bbScore01 +
    w.vol * volScore;

  let blend = baseBlend * (1 + 0.10 * (mtfScore - 0.5) * 2);

  if (i.squeeze && i.side === "BUY") blend *= 1.03;
  if (i.squeeze && i.side === "SELL") blend *= 0.97;

  if (typeof i.algoConfidence01 === "number") {
    blend = 0.7 * blend + 0.3 * i.algoConfidence01;
  }

  let p_hit_given_fill = toConfidence01(blend);

  // Guardrails (no news/session effects)
  if (i.adrUsed >= 0.9) p_hit_given_fill -= 0.10;
  else if (i.adrUsed >= 0.8) p_hit_given_fill -= 0.05;

  // Optional: assume optimal session already accounted in entry logic; no extra boost/penalty

  p_hit_given_fill = Math.max(0.15, Math.min(0.90, clamp01(p_hit_given_fill)));

  let p_fill = fillProbability(i.entryDistATR);
  if (i.side === "BUY" && i.zoneType === "resistance") p_fill *= 0.9;
  if (i.side === "SELL" && i.zoneType === "support") p_fill *= 0.9;
  p_fill = clamp01(p_fill);

  const headline_confidence = clamp01(0.5 * p_hit_given_fill + 0.5 * (p_hit_given_fill * p_fill));

  return {
    confidence_conditional: p_hit_given_fill,
    p_fill,
    headline_confidence,
    telemetry: {
      components: { trend, rsiScore, srScore, macdScore, bbScore01, volScore, mtfScore },
      blend,
      guardrails: {
        adrUsed: i.adrUsed,
        redNewsSoon: false,
        session: "optimal",
      },
      geom: {
        entryDistATR: i.entryDistATR,
        zoneType: i.zoneType,
        zoneStrength: i.zoneStrength,
        zoneMid: i.zoneMid,
      },
    },
  };
}

export function buildAIRequestPayload(scored: ScoringInputs, base: DeterministicResult): AIRequestPayload {
  return {
    side: scored.side,
    price: scored.price,
    entry: scored.entry,
    sl: scored.sl,
    atr: scored.atr,
    atrPct: scored.atrPct,
    rsi: scored.rsi,
    macdHist: scored.macdHist,
    ema20: scored.ema20,
    ema50: scored.ema50,
    ema100: scored.ema100,
    ema20Slope: scored.ema20Slope,
    ema50Slope: scored.ema50Slope,
    bbLower: scored.bbLower,
    bbUpper: scored.bbUpper,
    bbWidthPct: scored.bbWidthPct,
    bias4h: scored.bias4h,
    squeeze: scored.squeeze,
    adrUsed: scored.adrUsed,
    session: scored.session,
    redNewsSoon: false,
    zone: { type: scored.zoneType, strength: scored.zoneStrength, mid: scored.zoneMid },
    entryDistATR: scored.entryDistATR,
    base_confidence_conditional: base.confidence_conditional,
    p_fill: base.p_fill,
  };
}

export const AI_SYSTEM_PROMPT = `
You are a trading risk rater. Return ONLY valid JSON. Evaluate a limit-order setup within a 36h horizon.
Score = probability TP is hit before SL once filled.
Rubric:
- 0.80–0.90: multiple strong, aligned confluences (trend+MTF+structure+clean entry).
- 0.60–0.79: good setup with confirmation and no major red flags.
- 0.40–0.59: mixed/average.
- 0.20–0.39: weak/contradictory.
Ignore session and news effects (assume optimal session, no red news).
Your adjustment must be conservative: do not exceed ±0.15 delta to the provided base score.
`;

export function buildAIUserPrompt(payload: AIRequestPayload): string {
  return JSON.stringify(payload);
}

export function coerceAIResponse(maybe: any): AIResponse {
  const out: AIResponse = {
    ai_confidence_conditional: clamp01(Number(maybe?.ai_confidence_conditional ?? 0.5)),
    delta_confidence: Number(maybe?.delta_confidence ?? 0),
    delta_p_fill: typeof maybe?.delta_p_fill === "number" ? maybe.delta_p_fill : 0,
    direction_agree: !!maybe?.direction_agree,
    reasons: Array.isArray(maybe?.reasons) ? maybe.reasons.map(String) : [],
  };
  out.delta_confidence = Math.max(-0.15, Math.min(0.15, out.delta_confidence));
  if (typeof out.delta_p_fill === "number") {
    out.delta_p_fill = Math.max(-0.2, Math.min(0.2, out.delta_p_fill));
  }
  out.ai_confidence_conditional = Math.max(0.2, Math.min(0.9, out.ai_confidence_conditional));
  return out;
}

export function blendConfidence(
  base_confidence_conditional: number,
  ai: AIResponse,
  ctx: { adrUsed: number; volumeType: "synthetic" | "real" }
): number {
  let alpha = 0.25;
  if (!ai.direction_agree) alpha = 0.10;
  if (ctx.adrUsed > 0.9) alpha = Math.min(alpha, 0.15);
  if (ctx.volumeType === "synthetic") alpha = Math.min(alpha, 0.15);

  const combined = Math.max(
    0.2,
    Math.min(
      0.9,
      base_confidence_conditional * (1 - alpha) + ai.ai_confidence_conditional * alpha + ai.delta_confidence,
    ),
  );
  return combined;
}

export async function rateSetup(
  priceMeta: PriceMeta,
  ta: TAJson,
  ctx: SignalContext,
  opts?: {
    useAI?: boolean;
    callLLM?: (systemPrompt: string, userJson: string) => Promise<any>;
    aiGateBand?: [number, number];
  },
): Promise<{
  deterministic: DeterministicResult;
  combined_confidence: number;
  p_fill: number;
  ai?: AIResponse;
}> {
  const scoringInputs = toScoringInputs(priceMeta, ta, ctx);
  const det = deterministicConfidence(scoringInputs);

  let combined = det.confidence_conditional;
  let aiResp: AIResponse | undefined;

  const gate: [number, number] = opts?.aiGateBand ?? [0.45, 0.70];
  const withinGate = det.confidence_conditional >= gate[0] && det.confidence_conditional <= gate[1];

  if (opts?.useAI && opts?.callLLM && withinGate) {
    const payload = buildAIRequestPayload(scoringInputs, det);
    const raw = await opts.callLLM(AI_SYSTEM_PROMPT, buildAIUserPrompt(payload));
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    aiResp = coerceAIResponse(parsed);
    combined = blendConfidence(det.confidence_conditional, aiResp, {
      adrUsed: scoringInputs.adrUsed,
      volumeType: scoringInputs.volumeType,
    });
  }

  return {
    deterministic: det,
    combined_confidence: combined,
    p_fill: det.p_fill,
    ai: aiResp,
  };
}

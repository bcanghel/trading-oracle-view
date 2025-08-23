export type EconomicEvent =
  | "CPI" | "Core CPI" | "PCE"
  | "NFP" | "Unemployment" | "Jobless Claims"
  | "GDP"
  | "PMI Manufacturing" | "PMI Services"
  | "Retail Sales"
  | "Rate Decision";

export type G10 =
  | "USD" | "EUR" | "GBP" | "JPY" | "CHF" | "AUD" | "NZD" | "CAD";

export interface FundamentalRelease {
  currency: G10;
  event: EconomicEvent;
  time: string;          // ISO 8601
  actual: number;
  forecast: number | null;
  previous: number | null;
}

export interface FundamentalsInput {
  baseCcy: G10;
  quoteCcy: G10;
  releases: FundamentalRelease[];
}

export interface FundamentalsValidation {
  ok: boolean;
  cleaned: FundamentalsInput;
  issues: string[];      // human-readable problems found (for logs)
}

export interface FundamentalBias {
  overallBias: "BULLISH" | "BEARISH" | "NEUTRAL";
  strength: number; // 0-100
  summary: string;
  keyEvents: string[];
}
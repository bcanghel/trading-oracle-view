import {
  EconomicEvent, G10,
  FundamentalsInput, FundamentalRelease, FundamentalsValidation
} from "./fundamentals-types.ts";

// Allowed sets
const ALLOWED_EVENTS: Set<EconomicEvent> = new Set([
  "CPI","Core CPI","PCE",
  "NFP","Unemployment","Jobless Claims",
  "GDP",
  "PMI Manufacturing","PMI Services",
  "Retail Sales",
  "Rate Decision"
]);

const ALLOWED_CCYS: Set<G10> = new Set(["USD","EUR","GBP","JPY","CHF","AUD","NZD","CAD"]);

// Config
const LOOKBACK_DAYS = 14;
const MAX_RELEASES = 60; // guardrail to keep tokens small

function isIsoDate(s: string): boolean {
  const t = Date.parse(s);
  return Number.isFinite(t);
}

function withinDays(iso: string, days: number): boolean {
  const t = Date.parse(iso);
  const now = Date.now();
  const diff = (now - t) / 86_400_000;
  return diff >= 0 && diff <= days;
}

function toNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function normEventName(e: string): EconomicEvent | null {
  const x = String(e ?? '').trim();

  // Core CPI aliases first
  if (/(^|\b)core\b.*(cpi|consumer\s*price|inflation)/i.test(x)) return "Core CPI";

  // CPI aliases
  if (/^(cpi)\b/i.test(x)) return "CPI";
  if (/(consumer\s*price|inflation\s*rate|inflation)\b/i.test(x)) return "CPI";
  if (/\bcpi\s*(m\/m|q\/q|y\/y)/i.test(x)) return "CPI";

  // PCE aliases
  if (/^pce$/i.test(x)) return "PCE";
  if (/(core\s*)?pce(\s*price\s*index)?/i.test(x)) return "PCE";
  if (/personal\s*consumption\s*expenditures/i.test(x)) return "PCE";

  // NFP aliases
  if (/non[-\s]?farm.*payroll/i.test(x) || /\bNFP\b/i.test(x) || /payrolls/i.test(x)) return "NFP";

  // Unemployment rate
  if (/unemployment(\s*rate)?/i.test(x) || /jobless\s*rate/i.test(x)) return "Unemployment";

  // Jobless claims
  if (/((initial|continuing)\s*)?(jobless|unemployment)\s*claims/i.test(x) || /^claims$/i.test(x)) return "Jobless Claims";

  // GDP
  if (/^gdp\b/i.test(x) || /gross\s*domestic\s*product/i.test(x)) return "GDP";

  // PMI Manufacturing
  if (/((ism|s&p\s*global|markit).*)?manufacturing.*(pmi|index)/i.test(x) || /manufacturing\s*pmi/i.test(x)) return "PMI Manufacturing";

  // PMI Services (incl. non-manufacturing)
  if (/((ism|s&p\s*global|markit).*)?(services|non[-\s]?manufacturing).*(pmi|index)/i.test(x) || /services\s*pmi/i.test(x)) return "PMI Services";

  // Retail Sales
  if (/retail\s*sales/i.test(x)) return "Retail Sales";

  // Rate Decision / Policy Rate
  if (/rate.*decision/i.test(x) || /interest\s*rate\s*decision/i.test(x) || /\bfomc\b/i.test(x) || /federal\s*funds\s*rate/i.test(x) || /policy\s*rate/i.test(x) || /monetary\s*policy\s*decision/i.test(x) || /cash\s*rate/i.test(x) || /overnight\s*rate/i.test(x)) return "Rate Decision";

  // exact matches
  if (ALLOWED_EVENTS.has(x as EconomicEvent)) return x as EconomicEvent;
  return null;
}

function normCcy(c: string): G10 | null {
  const up = c.trim().toUpperCase();
  return ALLOWED_CCYS.has(up as G10) ? (up as G10) : null;
}

export function validateFundamentals(input: any): FundamentalsValidation {
  const issues: string[] = [];

  // base/quote
  const base = normCcy(input?.baseCcy ?? "");
  const quote = normCcy(input?.quoteCcy ?? "");
  if (!base) issues.push("Invalid or missing baseCcy");
  if (!quote) issues.push("Invalid or missing quoteCcy");
  if (base && quote && base === quote) issues.push("baseCcy and quoteCcy cannot be the same");

  // releases array
  const rawReleases: any[] = Array.isArray(input?.releases) ? input.releases : [];
  if (!rawReleases.length) issues.push("No releases provided");

  // sanitize releases
  const cleanedReleases: FundamentalRelease[] = [];
  for (const [idx, r] of rawReleases.entries()) {
    const ccy = normCcy(r?.currency ?? "");
    if (!ccy) { issues.push(`release[${idx}]: invalid currency`); continue; }

    const ev = normEventName(String(r?.event ?? "")) as EconomicEvent | null;
    if (!ev) { issues.push(`release[${idx}]: invalid event`); continue; }

    const time = String(r?.time ?? "");
    if (!isIsoDate(time)) { issues.push(`release[${idx}]: invalid ISO time`); continue; }
    if (!withinDays(time, LOOKBACK_DAYS)) { issues.push(`release[${idx}]: outside 14-day window`); continue; }

    const actual = toNumOrNull(r?.actual);
    if (actual === null) { issues.push(`release[${idx}]: missing/NaN actual`); continue; }

    const forecast = toNumOrNull(r?.forecast);
    const previous = toNumOrNull(r?.previous);

    cleanedReleases.push({ currency: ccy, event: ev, time, actual, forecast, previous });
  }

  // sort newest → oldest (optional)
  cleanedReleases.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));

  // cap
  if (cleanedReleases.length > MAX_RELEASES) {
    issues.push(`too many releases (${cleanedReleases.length}); truncated to ${MAX_RELEASES}`);
  }
  const releases = cleanedReleases.slice(0, MAX_RELEASES);

  const cleaned: FundamentalsInput = {
    baseCcy: base ?? "EUR",
    quoteCcy: quote ?? "USD",
    releases
  };

  const ok = issues.length === 0 && releases.length > 0 && !!base && !!quote && base !== quote;
  return { ok, cleaned, issues };
}
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LotCalculationRequest {
  symbol: string;
  entryPrice: number;
  stopLoss: number;
  accountBalance: number;
  riskPercentage: number; // e.g., 1 for 1%
  leverage: number; // e.g., 100 for 1:100
  accountCurrency?: string; // USD, EUR, etc.
}

interface LotCalculationResult {
  standardLot: number;
  microLot: number;
  riskAmount: number;
  marginRequired: number;
  pipValue: number;
  pipRisk: number;
  accountSize: string;
}

interface MultiAccountCalculation {
  symbol: string;
  entryPrice: number;
  stopLoss: number;
  calculations: {
    account10k: LotCalculationResult;
    account25k: LotCalculationResult;
  };
}

// Standard forex pip values for major pairs (per standard lot)
const PIP_VALUES: { [key: string]: number } = {
  'EUR/USD': 10, // $10 per pip per standard lot
  'GBP/USD': 10,
  'AUD/USD': 10,
  'NZD/USD': 10,
  'USD/JPY': 9.09, // Approximate, varies with USD/JPY rate
  'USD/CHF': 10.87, // Approximate, varies with USD/CHF rate
  'USD/CAD': 7.69, // Approximate, varies with USD/CAD rate
  'EUR/GBP': 12.87, // Approximate
  'EUR/JPY': 9.09,
  'GBP/JPY': 9.09,
  'DEFAULT': 10 // Default for unknown pairs
};

function getPipValue(symbol: string): number {
  // Remove any spaces and convert to uppercase
  const cleanSymbol = symbol.replace(/\s/g, '').toUpperCase();
  
  // Try exact match first
  if (PIP_VALUES[cleanSymbol]) {
    return PIP_VALUES[cleanSymbol];
  }
  
  // Try with forward slash if not present
  if (!cleanSymbol.includes('/') && cleanSymbol.length === 6) {
    const formattedSymbol = `${cleanSymbol.slice(0, 3)}/${cleanSymbol.slice(3)}`;
    if (PIP_VALUES[formattedSymbol]) {
      return PIP_VALUES[formattedSymbol];
    }
  }
  
  return PIP_VALUES.DEFAULT;
}

function calculatePipDifference(entryPrice: number, stopLoss: number, symbol: string): number {
  // Determine pip decimal place based on pair
  const isJPYPair = symbol.includes('JPY');
  const pipDecimal = isJPYPair ? 0.01 : 0.0001;
  
  return Math.abs(entryPrice - stopLoss) / pipDecimal;
}

function calculateLotSize(params: LotCalculationRequest): LotCalculationResult {
  const {
    symbol,
    entryPrice,
    stopLoss,
    accountBalance,
    riskPercentage,
    leverage
  } = params;

  // Calculate risk amount in account currency
  const riskAmount = accountBalance * (riskPercentage / 100);
  
  // Calculate pip difference
  const pipRisk = calculatePipDifference(entryPrice, stopLoss, symbol);
  
  // Get pip value for this symbol
  const pipValue = getPipValue(symbol);
  
  // Calculate position size in standard lots
  // Formula: Risk Amount / (Pip Risk × Pip Value) = Standard Lots
  const standardLot = pipRisk > 0 ? riskAmount / (pipRisk * pipValue) : 0;
  
  // Convert to micro lots (1 standard lot = 1000 micro lots)
  const microLot = standardLot * 1000;
  
  // Calculate margin required
  // Formula: (Lot Size × Contract Size × Entry Price) / Leverage
  // Standard lot contract size is 100,000 units
  const marginRequired = (standardLot * 100000 * entryPrice) / leverage;
  
  // Format account size for display
  const accountSize = accountBalance >= 1000000 
    ? `$${(accountBalance / 1000000).toFixed(1)}M`
    : accountBalance >= 1000 
    ? `$${(accountBalance / 1000).toFixed(0)}K`
    : `$${accountBalance.toFixed(0)}`;

  return {
    standardLot: Number(standardLot.toFixed(3)),
    microLot: Number(microLot.toFixed(0)),
    riskAmount: Number(riskAmount.toFixed(2)),
    marginRequired: Number(marginRequired.toFixed(2)),
    pipValue,
    pipRisk: Number(pipRisk.toFixed(1)),
    accountSize
  };
}

function calculateMultipleAccounts(
  symbol: string, 
  entryPrice: number, 
  stopLoss: number,
  riskPercentage = 1,
  leverage = 100
): MultiAccountCalculation {
  const baseParams = {
    symbol,
    entryPrice,
    stopLoss,
    riskPercentage,
    leverage,
    accountCurrency: 'USD'
  };

  return {
    symbol,
    entryPrice,
    stopLoss,
    calculations: {
      account10k: calculateLotSize({
        ...baseParams,
        accountBalance: 10000
      }),
      account25k: calculateLotSize({
        ...baseParams,
        accountBalance: 25000
      })
    }
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    
    // Handle single calculation
    if (requestData.accountBalance) {
      const result = calculateLotSize(requestData as LotCalculationRequest);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Handle multiple account calculation
    const { symbol, entryPrice, stopLoss, riskPercentage = 1, leverage = 100 } = requestData;
    
    if (!symbol || !entryPrice || !stopLoss) {
      throw new Error('Missing required parameters: symbol, entryPrice, stopLoss');
    }
    
    const result = calculateMultipleAccounts(symbol, entryPrice, stopLoss, riskPercentage, leverage);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in lot-size-calculator function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
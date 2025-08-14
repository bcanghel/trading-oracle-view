import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { calculateLotSizes } from "@/lib/api";

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

export function LotSizeCalculator() {
  const { toast } = useToast();
  const [symbol, setSymbol] = useState('EUR/USD');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<MultiAccountCalculation | null>(null);

  const handleCalculate = async () => {
    if (!symbol || !entryPrice || !stopLoss) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const entry = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);

    if (isNaN(entry) || isNaN(sl)) {
      toast({
        title: "Invalid Input",
        description: "Please enter valid numeric values",
        variant: "destructive"
      });
      return;
    }

    if (Math.abs(entry - sl) < 0.0001) {
      toast({
        title: "Invalid Stop Loss",
        description: "Stop loss must be different from entry price",
        variant: "destructive"
      });
      return;
    }

    setIsCalculating(true);
    try {
      const calculation = await calculateLotSizes(symbol, entry, sl, 1, 100);
      setResult(calculation);
      
      toast({
        title: "Calculation Complete",
        description: "Lot sizes calculated successfully",
      });
    } catch (error) {
      console.error('Calculation error:', error);
      toast({
        title: "Calculation Failed",
        description: "Failed to calculate lot sizes. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const pipRisk = result ? result.calculations.account10k.pipRisk : 0;
  const expectedProfit10k = result ? result.calculations.account10k.riskAmount * 2 : 0;
  const expectedProfit25k = result ? result.calculations.account25k.riskAmount * 2 : 0;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Lot Size Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="symbol">Currency Pair</Label>
            <Input
              id="symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="EUR/USD"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="entry">Entry Price</Label>
            <Input
              id="entry"
              type="number"
              step="0.00001"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              placeholder="1.17000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stoploss">Stop Loss</Label>
            <Input
              id="stoploss"
              type="number"
              step="0.00001"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder="1.16500"
            />
          </div>
        </div>

        <Button 
          onClick={handleCalculate} 
          disabled={isCalculating}
          className="w-full"
        >
          {isCalculating ? "Calculating..." : "Calculate Lot Sizes"}
        </Button>

        {/* Results Section */}
        {result && (
          <div className="space-y-6">
            {/* Risk Summary */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <h3 className="font-semibold mb-3">Risk Management Summary (1% Risk, 2:1 R/R)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="font-medium text-primary">Pip Risk</div>
                  <div className="text-2xl font-bold">{pipRisk.toFixed(1)} pips</div>
                </div>
                <div>
                  <div className="font-medium text-green-600 dark:text-green-400">Expected Profit (2:1)</div>
                  <div className="text-lg">
                    $100 → $200 | $250 → $500
                  </div>
                </div>
                <div>
                  <div className="font-medium text-red-600 dark:text-red-400">Max Risk (1%)</div>
                  <div className="text-lg">
                    $100 | $250
                  </div>
                </div>
              </div>
            </div>

            {/* Account Calculations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* $10K Account */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    $10K Account
                    <Badge variant="secondary">1% = $100</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Standard Lots:</span>
                    <span className="font-semibold">{result.calculations.account10k.standardLot}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Micro Lots:</span>
                    <span className="font-semibold">{result.calculations.account10k.microLot}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Risk Amount:</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      ${result.calculations.account10k.riskAmount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profit Potential:</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      ${expectedProfit10k.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pip Value:</span>
                    <span className="font-semibold">${result.calculations.account10k.pipValue}/pip</span>
                  </div>
                </CardContent>
              </Card>

              {/* $25K Account */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    $25K Account
                    <Badge variant="secondary">1% = $250</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Standard Lots:</span>
                    <span className="font-semibold">{result.calculations.account25k.standardLot}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Micro Lots:</span>
                    <span className="font-semibold">{result.calculations.account25k.microLot}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Risk Amount:</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      ${result.calculations.account25k.riskAmount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profit Potential:</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      ${expectedProfit25k.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pip Value:</span>
                    <span className="font-semibold">${result.calculations.account25k.pipValue}/pip</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Technical Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Technical Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Symbol</div>
                    <div className="font-semibold">{result.symbol}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Entry Price</div>
                    <div className="font-semibold">{result.entryPrice}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Stop Loss</div>
                    <div className="font-semibold">{result.stopLoss}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Leverage</div>
                    <div className="font-semibold">1:100</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
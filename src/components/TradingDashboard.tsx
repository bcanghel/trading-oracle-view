import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchMarketData, analyzeTradingOpportunity } from "@/lib/api";

interface TradingRecommendation {
  action: 'BUY' | 'SELL';
  confidence: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  support: number;
  resistance: number;
  reasoning: string;
  riskReward: number;
}

interface MarketData {
  symbol: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  high24h: number;
  low24h: number;
}

const FOREX_PAIRS = [
  { value: "EUR/USD", label: "EUR/USD" },
  { value: "GBP/USD", label: "GBP/USD" },
  { value: "USD/JPY", label: "USD/JPY" },
  { value: "USD/CHF", label: "USD/CHF" },
  { value: "AUD/USD", label: "AUD/USD" },
  { value: "USD/CAD", label: "USD/CAD" },
  { value: "NZD/USD", label: "NZD/USD" },
  { value: "EUR/GBP", label: "EUR/GBP" },
  { value: "EUR/JPY", label: "EUR/JPY" },
  { value: "GBP/JPY", label: "GBP/JPY" },
];

export function TradingDashboard() {
  const { toast } = useToast();
  const [selectedPair, setSelectedPair] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [recommendation, setRecommendation] = useState<TradingRecommendation | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [showRawData, setShowRawData] = useState(false);
  const [analysisInputData, setAnalysisInputData] = useState<any>(null);

  const analyzeMarket = async () => {
    if (!selectedPair) {
      toast({
        title: "Error",
        description: "Please select a currency pair first",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      // Fetch historical data from Twelve API
      const data = await fetchMarketData(selectedPair);
      setMarketData(data.currentData);
      setHistoricalData(data.historicalData);

      // Get AI analysis
      const analysis = await analyzeTradingOpportunity(
        selectedPair,
        data.historicalData,
        data.currentData
      );
      setRecommendation(analysis.recommendation);

      // Store the input data that was sent to AI
      setAnalysisInputData({
        symbol: selectedPair,
        currentData: data.currentData,
        historicalData: data.historicalData,
        technicalAnalysis: analysis.technicalAnalysis
      });

      toast({
        title: "Analysis Complete",
        description: `Trading recommendation generated for ${selectedPair}`,
      });
    } catch (error) {
      console.error("Error analyzing market:", error);
      toast({
        title: "Error",
        description: "Failed to analyze market data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Trading Oracle</h1>
            <p className="text-muted-foreground">AI-Powered Forex Trading Analysis</p>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Live Market Data</span>
          </div>
        </div>

        {/* Trading Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Market Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1 max-w-xs">
                <label className="text-sm font-medium mb-2 block">Currency Pair</label>
                <Select value={selectedPair} onValueChange={setSelectedPair}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a pair" />
                  </SelectTrigger>
                  <SelectContent>
                    {FOREX_PAIRS.map((pair) => (
                      <SelectItem key={pair.value} value={pair.value}>
                        {pair.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={analyzeMarket} 
                disabled={!selectedPair || isAnalyzing}
                className="min-w-[140px]"
              >
                {isAnalyzing ? "Analyzing..." : "Analyze Market"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Market Data Display */}
        {marketData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Price</p>
                    <p className="text-2xl font-bold">{marketData.currentPrice.toFixed(5)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">24h Change</p>
                    <p className={`text-2xl font-bold ${marketData.change >= 0 ? 'text-buy' : 'text-sell'}`}>
                      {marketData.changePercent.toFixed(2)}%
                    </p>
                  </div>
                  {marketData.change >= 0 ? (
                    <TrendingUp className="h-8 w-8 text-buy" />
                  ) : (
                    <TrendingDown className="h-8 w-8 text-sell" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">24h High</p>
                  <p className="text-2xl font-bold">{marketData.high24h.toFixed(5)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">24h Low</p>
                  <p className="text-2xl font-bold">{marketData.low24h.toFixed(5)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Trading Recommendation */}
        {recommendation && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                AI Trading Recommendation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Badge 
                  variant={recommendation.action === 'BUY' ? 'default' : 'destructive'}
                  className={`text-lg px-4 py-2 ${
                    recommendation.action === 'BUY' 
                      ? 'bg-buy hover:bg-buy/90' 
                      : 'bg-sell hover:bg-sell/90'
                  }`}
                >
                  {recommendation.action}
                </Badge>
                <div className="text-sm text-muted-foreground">
                  Confidence: <span className="font-semibold">{recommendation.confidence}%</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Risk/Reward: <span className="font-semibold">1:{recommendation.riskReward.toFixed(2)}</span>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Entry Level</h4>
                  <p className="text-2xl font-bold text-foreground">{recommendation.entry.toFixed(5)}</p>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Stop Loss</h4>
                  <p className="text-2xl font-bold text-sell">{recommendation.stopLoss.toFixed(5)}</p>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Take Profit</h4>
                  <p className="text-2xl font-bold text-buy">{recommendation.takeProfit.toFixed(5)}</p>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Support Level</h4>
                  <p className="text-xl font-semibold text-muted-foreground">{recommendation.support.toFixed(5)}</p>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Resistance Level</h4>
                  <p className="text-xl font-semibold text-muted-foreground">{recommendation.resistance.toFixed(5)}</p>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Analysis Reasoning</h4>
                <p className="text-muted-foreground leading-relaxed">{recommendation.reasoning}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Raw Analysis Data Display */}
        {analysisInputData && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {showRawData ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  Raw Analysis Data
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRawData(!showRawData)}
                >
                  {showRawData ? "Hide" : "Show"} Data
                </Button>
              </div>
            </CardHeader>
            {showRawData && (
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Current Market Data</h4>
                  <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                    {JSON.stringify(analysisInputData.currentData, null, 2)}
                  </pre>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-semibold mb-2">Technical Analysis</h4>
                  <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                    {JSON.stringify(analysisInputData.technicalAnalysis, null, 2)}
                  </pre>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-semibold mb-2">Historical Data ({analysisInputData.historicalData?.length || 0} candles)</h4>
                  <pre className="bg-muted p-3 rounded text-sm overflow-x-auto max-h-64">
                    {JSON.stringify(analysisInputData.historicalData, null, 2)}
                  </pre>
                </div>
              </CardContent>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
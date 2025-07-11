import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, AlertTriangle, Eye, EyeOff, History, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchMarketData, analyzeTradingOpportunity } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import UserMenu from "@/components/UserMenu";

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
  entryConditions?: string;
  entryTiming?: string;
  volumeConfirmation?: string;
  candlestickSignals?: string;
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

interface SavedAnalysis {
  id: string;
  symbol: string;
  api_response: any;
  ai_analysis: any;
  created_at: string;
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
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [showSavedAnalyses, setShowSavedAnalyses] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);

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

      // Check if AI analysis failed
      if (analysis.aiError) {
        setRecommendation(null);
        setAnalysisInputData(null);
        toast({
          title: "AI Analysis Unavailable",
          description: "AI analysis is currently unavailable. Please try again later.",
          variant: "destructive",
        });
        return;
      }

      setRecommendation(analysis.recommendation);

      // Store the input data that was sent to AI
      setAnalysisInputData({
        symbol: selectedPair,
        currentData: data.currentData,
        historicalData: data.historicalData,
        technicalAnalysis: analysis.technicalAnalysis
      });

      // Save to Supabase only if analysis succeeded
      await saveAnalysisToDatabase(data, analysis);

      toast({
        title: "Analysis Complete",
        description: `AI trading recommendation generated for ${selectedPair}`,
      });
    } catch (error) {
      console.error("Error analyzing market:", error);
      
      // Check if it's an AI-specific error
      if (error.message?.includes('AI analysis unavailable')) {
        setRecommendation(null);
        setAnalysisInputData(null);
        toast({
          title: "AI Analysis Unavailable",
          description: "AI analysis is currently unavailable. Please try again later.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to analyze market data. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveAnalysisToDatabase = async (marketData: any, analysis: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("No user authenticated, skipping save");
        return;
      }

      const { error } = await supabase
        .from('trade_analyses')
        .insert({
          user_id: user.id,
          symbol: selectedPair,
          api_response: marketData,
          ai_analysis: analysis
        });

      if (error) {
        console.error("Error saving analysis:", error);
      } else {
        console.log("Analysis saved successfully");
        loadSavedAnalyses(); // Refresh the list
      }
    } catch (error) {
      console.error("Error saving analysis:", error);
    }
  };

  const loadSavedAnalyses = async () => {
    setIsLoadingSaved(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('trade_analyses')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error("Error loading saved analyses:", error);
      } else {
        setSavedAnalyses(data || []);
      }
    } catch (error) {
      console.error("Error loading saved analyses:", error);
    } finally {
      setIsLoadingSaved(false);
    }
  };

  const deleteAnalysis = async (id: string) => {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("No user authenticated, cannot delete");
        toast({
          title: "Error",
          description: "You must be logged in to delete analyses",
          variant: "destructive",
        });
        return;
      }

      console.log("Attempting to delete analysis:", id, "for user:", user.id);
      
      const { error } = await supabase
        .from('trade_analyses')
        .delete()
        .eq('id', id);

      if (error) {
        console.error("Error deleting analysis:", error);
        toast({
          title: "Error",
          description: `Failed to delete analysis: ${error.message}`,
          variant: "destructive",
        });
      } else {
        console.log("Analysis deleted successfully");
        toast({
          title: "Deleted",
          description: "Analysis deleted successfully",
        });
        loadSavedAnalyses(); // Refresh the list
      }
    } catch (error) {
      console.error("Error deleting analysis:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while deleting the analysis",
        variant: "destructive",
      });
    }
  };

  const loadAnalysis = (savedAnalysis: SavedAnalysis) => {
    const { api_response, ai_analysis } = savedAnalysis;
    setSelectedPair(savedAnalysis.symbol);
    setMarketData(api_response.currentData);
    setHistoricalData(api_response.historicalData);
    setRecommendation(ai_analysis.recommendation);
    setAnalysisInputData({
      symbol: savedAnalysis.symbol,
      currentData: api_response.currentData,
      historicalData: api_response.historicalData,
      technicalAnalysis: ai_analysis.technicalAnalysis
    });
  };

  useEffect(() => {
    loadSavedAnalyses();
  }, []);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Trading Oracle</h1>
            <p className="text-muted-foreground">AI-Powered Forex Trading Analysis</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Live Market Data</span>
            </div>
            <UserMenu />
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
              <Button
                variant="outline"
                onClick={() => setShowSavedAnalyses(!showSavedAnalyses)}
                className="min-w-[140px]"
              >
                <History className="h-4 w-4 mr-2" />
                {showSavedAnalyses ? "Hide" : "Show"} History
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Saved Analyses */}
        {showSavedAnalyses && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Saved Analyses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingSaved ? (
                <p className="text-muted-foreground">Loading saved analyses...</p>
              ) : savedAnalyses.length === 0 ? (
                <p className="text-muted-foreground">No saved analyses found</p>
              ) : (
                <div className="space-y-3">
                  {savedAnalyses.map((analysis) => (
                    <div
                      key={analysis.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{analysis.symbol}</Badge>
                        <div className="text-sm">
                          <p className="font-medium">
                            {analysis.ai_analysis.recommendation.action} - {analysis.ai_analysis.recommendation.confidence}% confidence
                          </p>
                          <p className="text-muted-foreground">
                            {new Date(analysis.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadAnalysis(analysis)}
                        >
                          Load
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteAnalysis(analysis.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
        {recommendation ? (
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

              {/* Enhanced Entry Conditions Section */}
              {(recommendation.entryConditions || recommendation.entryTiming || recommendation.volumeConfirmation || recommendation.candlestickSignals) && (
                <>
                  <Separator />
                  
                  <div className="space-y-4">
                    <h4 className="font-semibold text-base">Entry Conditions & Market Timing</h4>
                    
                    {recommendation.entryConditions && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Entry Trigger Conditions</p>
                        <div className="bg-muted/50 p-3 rounded-lg border-l-4 border-primary">
                          <p className="text-sm leading-relaxed">{recommendation.entryConditions}</p>
                        </div>
                      </div>
                    )}
                    
                    {recommendation.entryTiming && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Market Session & Timing</p>
                        <div className="bg-muted/50 p-3 rounded-lg border-l-4 border-blue-500">
                          <p className="text-sm leading-relaxed">{recommendation.entryTiming}</p>
                        </div>
                      </div>
                    )}
                    
                    {recommendation.volumeConfirmation && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Volume Confirmation</p>
                        <div className="bg-muted/50 p-3 rounded-lg border-l-4 border-green-500">
                          <p className="text-sm leading-relaxed">{recommendation.volumeConfirmation}</p>
                        </div>
                      </div>
                    )}
                    
                    {recommendation.candlestickSignals && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Candlestick Confirmation Signals</p>
                        <div className="bg-muted/50 p-3 rounded-lg border-l-4 border-orange-500">
                          <p className="text-sm leading-relaxed">{recommendation.candlestickSignals}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ) : marketData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                AI Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <div className="text-muted-foreground text-lg">
                  AI Analysis Unavailable
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  The AI trading analysis is currently unavailable. Please try analyzing again.
                </p>
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
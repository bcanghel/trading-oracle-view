import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, AlertTriangle, Eye, EyeOff, History, Trash2, Clock, Info, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchMarketData, analyzeTradingOpportunity } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import UserMenu from "@/components/UserMenu";
import { MarketSessions } from "@/components/MarketSessions";
import { AutoTradingPanel } from "@/components/AutoTradingPanel";
import USDFundamentals from "@/components/USDFundamentals";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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
  aiProvider?: 'claude' | 'openai';
  aiModel?: string;
  selectedOption?: string;
  entryPrecisionAnalysis?: {
    currentPrice: number;
    consistencyScore: number;
    buyOptions: Array<{
      classification: string;
      entryPrice: number;
      distanceInPips: number;
      confluence: number;
      riskReward: number;
      strength: number;
      reasoning: string[];
    }>;
    sellOptions: Array<{
      classification: string;
      entryPrice: number;
      distanceInPips: number;
      confluence: number;
      riskReward: number;
      strength: number;
      reasoning: string[];
    }>;
  };
  fundamentalsBias?: {
    overallBias: "BULLISH" | "BEARISH" | "NEUTRAL";
    strength: number;
    summary: string;
    keyEvents: string[];
  };
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
  strategy_type: string;
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
  // Always use enhanced multi-timeframe strategy (same as auto-trading)
  const selectedStrategy = "1H+4H";
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [recommendation, setRecommendation] = useState<TradingRecommendation | null>(null);
  const [confidenceScoring, setConfidenceScoring] = useState<any>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [historical4hData, setHistorical4hData] = useState<any[]>([]);
  const [currentStrategy, setCurrentStrategy] = useState<string>("1H");
  const [showRawData, setShowRawData] = useState(false);
  const [analysisInputData, setAnalysisInputData] = useState<any>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [showSavedAnalyses, setShowSavedAnalyses] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [aiProvider, setAiProvider] = useState<'claude' | 'openai' | 'deterministic'>('claude');

  // Session helper functions
  const getRomaniaHour = (date: Date = new Date()) => {
    return parseInt(date.toLocaleString('en-US', {
      timeZone: 'Europe/Bucharest',
      hour: '2-digit',
      hour12: false
    }));
  };

  const getNextSession = () => {
    const currentHour = getRomaniaHour();
    
    if (currentHour < 2) {
      return { name: 'Asian Open', time: '02:00', hoursUntil: 2 - currentHour };
    } else if (currentHour < 10) {
      return { name: 'London Open', time: '10:00', hoursUntil: 10 - currentHour };
    } else if (currentHour < 15) {
      return { name: 'London-NY Overlap', time: '15:00', hoursUntil: 15 - currentHour };
    } else if (currentHour < 19) {
      return { name: 'London Close', time: '19:00', hoursUntil: 19 - currentHour };
    } else {
      return { name: 'Asian Open', time: '02:00 (Next Day)', hoursUntil: 24 - currentHour + 2 };
    }
  };

  const getSessionStatus = () => {
    const currentHour = getRomaniaHour();
    
    if ((currentHour >= 2 && currentHour < 11)) {
      return { status: 'active', name: 'Asian Session', priority: 'low' };
    } else if (currentHour >= 10 && currentHour < 19) {
      return { status: 'active', name: 'London Session', priority: 'high' };
    } else if (currentHour >= 15 && currentHour < 19) {
      return { status: 'active', name: 'London-NY Overlap', priority: 'highest' };
    } else if (currentHour >= 15 && currentHour < 24) {
      return { status: 'active', name: 'New York Session', priority: 'medium' };
    } else {
      return { status: 'closed', name: 'Markets Closed', priority: 'none' };
    }
  };

  const getPairSessionInfo = (symbol: string) => {
    const currentHour = getRomaniaHour();
    
    // Currency pair specific trading sessions and characteristics
    const pairSessionData = {
      'EUR/USD': {
        primarySessions: ['London', 'New York'],
        peakHours: [10, 11, 12, 13, 14, 15, 16, 17, 18], // London + London-NY overlap
        optimalVolume: 'Highest during London session and London-NY overlap',
        characteristics: 'Most liquid pair, tight spreads, highest volume',
        recommendation: 'Trade during London session (10:00-19:00) - peak at overlap (15:00-19:00)'
      },
      'GBP/USD': {
        primarySessions: ['London', 'New York'],
        peakHours: [10, 11, 12, 13, 14, 15, 16, 17, 18], // London + London-NY overlap
        optimalVolume: 'Highest during London session and early NY',
        characteristics: 'High volatility, news-sensitive, strong trends',
        recommendation: 'Best during London session (10:00-19:00) - avoid Asian session'
      },
      'USD/JPY': {
        primarySessions: ['Tokyo', 'New York'],
        peakHours: [2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 16, 17, 18, 19, 20], // Tokyo + NY sessions
        optimalVolume: 'High during Tokyo (02:00-11:00) and NY (15:00-24:00)',
        characteristics: 'Lower volatility, trend-following, interest rate sensitive',
        recommendation: 'Active during Tokyo and NY sessions - avoid London-only hours'
      },
      'USD/CHF': {
        primarySessions: ['London', 'New York'],
        peakHours: [10, 11, 12, 13, 14, 15, 16, 17], // European and early NY
        optimalVolume: 'Peak during European trading hours',
        characteristics: 'Safe-haven currency, EUR correlation, moderate volatility',
        recommendation: 'Most active during London and early NY sessions'
      },
      'AUD/USD': {
        primarySessions: ['Sydney', 'New York'],
        peakHours: [0, 1, 2, 3, 4, 5, 6, 7, 8, 15, 16, 17, 18], // Sydney + NY sessions
        optimalVolume: 'Peak during Sydney open and NY session',
        characteristics: 'Commodity-linked, RBA sensitive, volatile',
        recommendation: 'Best during Sydney session (00:00-09:00) and NY hours - avoid mid-session lull'
      },
      'USD/CAD': {
        primarySessions: ['London', 'New York'],
        peakHours: [13, 14, 15, 16, 17, 18, 19, 20], // London-NY overlap + NY session
        optimalVolume: 'Peak during North American trading hours',
        characteristics: 'Oil-correlated, BOC sensitive, North America focused',
        recommendation: 'Best during London-NY overlap and NY session (13:00-21:00)'
      },
      'NZD/USD': {
        primarySessions: ['Sydney', 'New York'],
        peakHours: [0, 1, 2, 3, 4, 5, 6, 15, 16, 17], // Sydney + NY sessions
        optimalVolume: 'Active during Sydney open and NY session',
        characteristics: 'Lower liquidity, RBNZ sensitive, Pacific focus',
        recommendation: 'Trade during Sydney session (00:00-09:00) and NY hours only'
      },
      'EUR/GBP': {
        primarySessions: ['London'],
        peakHours: [10, 11, 12, 13, 14, 15, 16, 17], // London session only
        optimalVolume: 'Highest during London session only',
        characteristics: 'Low volatility, tight ranges, requires London liquidity',
        recommendation: 'Trade ONLY during London session (10:00-18:00) - insufficient volume outside'
      },
      'EUR/JPY': {
        primarySessions: ['Tokyo', 'London'],
        peakHours: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // Tokyo + London + overlap
        optimalVolume: 'Active during Tokyo and London sessions',
        characteristics: 'Medium volatility cross pair, carry trade popular',
        recommendation: 'Best during Tokyo and London sessions - good during overlap (10:00-11:00)'
      },
      'GBP/JPY': {
        primarySessions: ['Tokyo', 'London'],
        peakHours: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], // Tokyo + London sessions
        optimalVolume: 'High during Tokyo and very high during London',
        characteristics: 'Highly volatile, trending pair, big moves',
        recommendation: 'High volatility during Tokyo, extreme during London - avoid quiet periods'
      }
    };

    const pairData = pairSessionData[symbol as keyof typeof pairSessionData] || {
      primarySessions: ['London', 'New York'],
      peakHours: [15, 16, 17, 18],
      optimalVolume: 'Standard forex hours',
      characteristics: 'Major currency pair',
      recommendation: 'Most active during major session overlaps'
    };

    const isPeakTime = pairData.peakHours.includes(currentHour);
    const nextSession = getNextSession();
    
    // Determine current session status
    let currentSessionName = '';
    let sessionStatus = 'closed';
    
    if (currentHour >= 2 && currentHour < 11) {
      currentSessionName = 'Asian Session';
      sessionStatus = 'active';
    } else if (currentHour >= 10 && currentHour < 19) {
      currentSessionName = 'London Session';
      sessionStatus = 'active';
      if (currentHour >= 15 && currentHour < 19) {
        currentSessionName = 'London-NY Overlap';
      }
    } else if (currentHour >= 15 && currentHour < 24) {
      currentSessionName = 'New York Session';
      sessionStatus = 'active';
    }
    
    // Calculate specific recommendation and priority
    let recommendation = '';
    let priority = 'low';
    
    if (isPeakTime && sessionStatus === 'active') {
      if (currentHour >= 15 && currentHour < 19 && 
          (symbol === 'EUR/USD' || symbol === 'GBP/USD' || symbol === 'USD/CHF')) {
        recommendation = `Peak liquidity for ${symbol} - highest volume and tightest spreads`;
        priority = 'highest';
      } else if (currentSessionName === 'London Session' && 
                 ['EUR/USD', 'GBP/USD', 'EUR/GBP', 'USD/CHF'].includes(symbol)) {
        recommendation = `Optimal ${symbol} trading - European session active`;
        priority = 'high';
      } else if (currentSessionName === 'Asian Session' && 
                 ['USD/JPY', 'AUD/USD', 'NZD/USD', 'EUR/JPY', 'GBP/JPY'].includes(symbol)) {
        recommendation = `Good ${symbol} session - Asian markets active`;
        priority = 'medium';
      } else {
        recommendation = `${symbol} trading active - ${pairData.characteristics}`;
        priority = 'medium';
      }
    } else {
      // Not in peak time - find next optimal session for this specific pair
      let nextOptimalHour;
      let nextSessionName;
      
      if (['EUR/USD', 'GBP/USD', 'USD/CHF', 'EUR/GBP'].includes(symbol)) {
        // European pairs - prioritize London and NY sessions
        if (currentHour < 10) {
          nextOptimalHour = 10;
          nextSessionName = 'London Open';
        } else if (currentHour < 15) {
          nextOptimalHour = 15;
          nextSessionName = 'London-NY Overlap';
        } else if (currentHour >= 19) {
          nextOptimalHour = 10; // Next day London
          nextSessionName = 'London Open (Next Day)';
        }
      } else if (['USD/JPY', 'EUR/JPY', 'GBP/JPY'].includes(symbol)) {
        // JPY pairs - Tokyo and London sessions
        if (currentHour < 2) {
          nextOptimalHour = 2;
          nextSessionName = 'Tokyo Open';
        } else if (currentHour >= 11 && currentHour < 15) {
          nextOptimalHour = 15;
          nextSessionName = 'NY Session';
        } else if (currentHour >= 19) {
          nextOptimalHour = 2; // Next day Tokyo
          nextSessionName = 'Tokyo Open (Next Day)';
        }
      } else if (['AUD/USD', 'NZD/USD'].includes(symbol)) {
        // Pacific pairs - Sydney and NY sessions
        if (currentHour >= 9 && currentHour < 15) {
          nextOptimalHour = 15;
          nextSessionName = 'NY Session';
        } else if (currentHour >= 19) {
          nextOptimalHour = 0; // Next day Sydney
          nextSessionName = 'Sydney Open (Next Day)';
        } else {
          nextOptimalHour = 0;
          nextSessionName = 'Sydney Open';
        }
      } else {
        // Default to major sessions
        if (currentHour < 10) {
          nextOptimalHour = 10;
          nextSessionName = 'London Open';
        } else {
          nextOptimalHour = 15;
          nextSessionName = 'NY Session';
        }
      }
      
      const hoursUntil = nextOptimalHour > currentHour ? 
                        nextOptimalHour - currentHour : 
                        (24 - currentHour) + nextOptimalHour;
      
      if (hoursUntil <= 2) {
        recommendation = `${symbol} optimal session starts in ${hoursUntil}h`;
        priority = 'upcoming';
      } else {
        recommendation = `Wait ${hoursUntil}h for optimal ${symbol} trading (${nextSessionName})`;
        priority = 'low';
      }
    }
    
    return { 
      recommendation, 
      priority, 
      nextSession: getNextOptimalSessionForPair(symbol, currentHour, pairData), 
      currentSession: { 
        name: currentSessionName, 
        status: sessionStatus 
      },
      pairData
    };
  };

  const getNextOptimalSessionForPair = (symbol: string, currentHour: number, pairData: any) => {
    // Find next high-volume session based on pair-specific peak hours
    const peakHours = pairData.peakHours;
    const nextPeakHour = peakHours.find(hour => hour > currentHour) || peakHours[0];
    const hoursUntil = nextPeakHour > currentHour ? 
                      nextPeakHour - currentHour : 
                      (24 - currentHour) + nextPeakHour;
    
    // Determine session name based on the next peak hour
    let sessionName = '';
    let sessionTime = '';
    
    if (['EUR/USD', 'GBP/USD', 'USD/CHF', 'EUR/GBP'].includes(symbol)) {
      if (nextPeakHour >= 10 && nextPeakHour < 15) {
        sessionName = 'London Open';
        sessionTime = '10:00';
      } else if (nextPeakHour >= 15 && nextPeakHour < 19) {
        sessionName = 'London-NY Overlap';
        sessionTime = '15:00';
      } else {
        sessionName = 'London Open';
        sessionTime = nextPeakHour > currentHour ? '10:00' : '10:00 (Next Day)';
      }
    } else if (['USD/JPY', 'EUR/JPY', 'GBP/JPY'].includes(symbol)) {
      if (nextPeakHour >= 2 && nextPeakHour < 11) {
        sessionName = 'Tokyo Session';
        sessionTime = '02:00';
      } else if (nextPeakHour >= 15 && nextPeakHour < 21) {
        sessionName = 'NY Session';
        sessionTime = '15:00';
      } else {
        sessionName = 'Tokyo Session';
        sessionTime = nextPeakHour > currentHour ? '02:00' : '02:00 (Next Day)';
      }
    } else if (['AUD/USD', 'NZD/USD'].includes(symbol)) {
      if (nextPeakHour >= 0 && nextPeakHour < 9) {
        sessionName = 'Sydney Session';
        sessionTime = '00:00';
      } else if (nextPeakHour >= 15 && nextPeakHour < 19) {
        sessionName = 'NY Session';
        sessionTime = '15:00';
      } else {
        sessionName = 'Sydney Session';
        sessionTime = nextPeakHour > currentHour ? '00:00' : '00:00 (Next Day)';
      }
    } else if (symbol === 'USD/CAD') {
      if (nextPeakHour >= 13 && nextPeakHour < 21) {
        sessionName = 'North American Session';
        sessionTime = '13:00';
      } else {
        sessionName = 'North American Session';
        sessionTime = nextPeakHour > currentHour ? '13:00' : '13:00 (Next Day)';
      }
    } else {
      // Default case
      sessionName = 'Next High Volume Session';
      sessionTime = `${nextPeakHour.toString().padStart(2, '0')}:00`;
    }
    
    return {
      name: sessionName,
      time: sessionTime,
      hoursUntil: hoursUntil
    };
  };

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
      // Get enhanced market data (same as auto-trading)
      const data = await fetchMarketData(selectedPair, selectedStrategy, false);
      setMarketData(data.currentData);
      setHistoricalData(data.historicalData);
      setHistorical4hData(data.historical4hData || []);
      setCurrentStrategy(data.strategy || selectedStrategy);

      // Get enhanced analysis with selected AI provider
      const analysis = await analyzeTradingOpportunity(
        selectedPair,
        data.historicalData,
        data.currentData,
        data.historical4hData,
        selectedStrategy,
         { useDeterministic: aiProvider === 'deterministic', historical1dData: data.historical1dData, aiProvider: aiProvider !== 'deterministic' ? aiProvider : undefined }
      );

      // Check if analysis failed or has errors
      if (!analysis.success) {
        setRecommendation(null);
        setConfidenceScoring(null);
        setAnalysisInputData(null);
        toast({
          title: "Analysis Failed",
          description: analysis.error || "Analysis failed due to missing required data. Real market data is needed.",
          variant: "destructive",
        });
        return;
      }

      if (analysis.aiError) {
        setRecommendation(null);
        setConfidenceScoring(null);
        setAnalysisInputData(null);
        toast({
          title: "Enhanced Analysis Unavailable",
          description: "Enhanced trading analysis is currently unavailable. Please try again later.",
          variant: "destructive",
        });
        return;
      }

      setRecommendation(analysis.recommendation);
      setConfidenceScoring(analysis.confidence);

      // Store the input data that was sent to AI
      setAnalysisInputData({
        symbol: selectedPair,
        currentData: data.currentData,
        historicalData: data.historicalData,
        historical4hData: data.historical4hData,
        technicalAnalysis: analysis.technicalAnalysis,
        trendAnalysis: analysis.trendAnalysis,
        marketSession: analysis.marketSession,
        strategy: analysis.strategy || selectedStrategy
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
        setConfidenceScoring(null);
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
          ai_analysis: analysis,
          strategy_type: selectedStrategy
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
    console.log('Load Analysis clicked:', savedAnalysis);
    
    try {
      const { api_response, ai_analysis } = savedAnalysis;
      
      console.log('API Response:', api_response);
      console.log('AI Analysis:', ai_analysis);
      
      setSelectedPair(savedAnalysis.symbol);
      setCurrentStrategy('1H+4H'); // Always use enhanced strategy
      setMarketData(api_response.currentData);
      setHistoricalData(api_response.historicalData);
      setHistorical4hData(api_response.historical4hData || []);
      setRecommendation(ai_analysis.recommendation);
      setConfidenceScoring(ai_analysis.confidence);
      setAnalysisInputData({
        symbol: savedAnalysis.symbol,
        currentData: api_response.currentData,
        historicalData: api_response.historicalData,
        historical4hData: api_response.historical4hData,
        technicalAnalysis: ai_analysis.technicalAnalysis,
        trendAnalysis: ai_analysis.trendAnalysis,
        marketSession: ai_analysis.marketSession,
        strategy: savedAnalysis.strategy_type || '1H'
      });
      
      console.log('Analysis loaded successfully');
      
      toast({
        title: "Analysis Loaded",
        description: `Loaded ${savedAnalysis.symbol} analysis from ${new Date(savedAnalysis.created_at).toLocaleString()}`,
      });
      
    } catch (error) {
      console.error('Error loading analysis:', error);
      toast({
        title: "Error Loading Analysis",
        description: "Failed to load the saved analysis. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadSavedAnalyses();
  }, []);

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Trading Oracle</h1>
            <p className="text-sm sm:text-base text-muted-foreground">AI-Powered Forex Trading Analysis</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-end gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <span className="text-xs sm:text-sm font-medium">Live Market Data</span>
            </div>
            <UserMenu />
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="analysis" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-4 h-12 sm:h-10">
            <TabsTrigger value="analysis" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-1 sm:px-3">
              <BarChart3 className="h-4 w-4 flex-shrink-0" />
              <span className="hidden xs:inline sm:inline">Market Analysis</span>
              <span className="xs:hidden sm:hidden">Analysis</span>
            </TabsTrigger>
            <TabsTrigger value="auto-trading" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-1 sm:px-3">
              <Activity className="h-4 w-4 flex-shrink-0" />
              <span className="hidden xs:inline sm:inline">Auto Trading</span>
              <span className="xs:hidden sm:hidden">Auto</span>
            </TabsTrigger>
            <TabsTrigger value="usd-fundamentals" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-1 sm:px-3">
              <DollarSign className="h-4 w-4 flex-shrink-0" />
              <span className="hidden xs:inline sm:inline">USD Fundamentals</span>
              <span className="xs:hidden sm:hidden">USD</span>
            </TabsTrigger>
            <TabsTrigger value="sessions" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-1 sm:px-3">
              <Clock className="h-4 w-4 flex-shrink-0" />
              <span className="hidden xs:inline sm:inline">Market Sessions</span>
              <span className="xs:hidden sm:hidden">Sessions</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analysis" className="space-y-4 sm:space-y-6">
            {/* Trading Controls */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
                  Market Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
                  <div className="space-y-2">
                    <label className="text-sm font-medium block">Currency Pair</label>
                    <Select value={selectedPair} onValueChange={setSelectedPair}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select a pair" />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        {FOREX_PAIRS.map((pair) => (
                          <SelectItem key={pair.value} value={pair.value}>
                            {pair.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                   </div>
                   <div className="space-y-2">
                     <label className="text-sm font-medium block">AI Analysis Provider</label>
                     <Select value={aiProvider} onValueChange={(value: 'claude' | 'openai' | 'deterministic') => setAiProvider(value)}>
                       <SelectTrigger className="h-10">
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent className="z-50">
                         <SelectItem value="claude">
                           <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                             Claude Opus 4.1 (Default)
                           </div>
                         </SelectItem>
                         <SelectItem value="openai">
                           <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-green-500"></div>
                               GPT-5
                           </div>
                         </SelectItem>
                         <SelectItem value="deterministic">
                           <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                             Deterministic Engine
                           </div>
                         </SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                    <div className="col-span-1 sm:col-span-2 lg:col-span-1 space-y-2 lg:space-y-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                      <Button 
                        onClick={analyzeMarket} 
                        disabled={!selectedPair || isAnalyzing}
                        className="w-full h-10"
                      >
                        {isAnalyzing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            <span className="hidden sm:inline">Analyzing...</span>
                            <span className="sm:hidden">Loading...</span>
                          </>
                        ) : (
                          <>
                            <BarChart3 className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Analyze Market</span>
                            <span className="sm:hidden">Analyze</span>
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowSavedAnalyses(!showSavedAnalyses)}
                        className="w-full h-10"
                      >
                        <History className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">{showSavedAnalyses ? "Hide" : "Show"} History</span>
                        <span className="sm:hidden">History</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

        {/* Saved Analyses */}
        {showSavedAnalyses && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <History className="h-4 w-4 sm:h-5 sm:w-5" />
                Saved Analyses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingSaved ? (
                <p className="text-muted-foreground text-center py-4">Loading saved analyses...</p>
              ) : savedAnalyses.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No saved analyses found</p>
              ) : (
                <div className="space-y-3">
                   {savedAnalyses.map((analysis) => {
                     const sessionInfo = getPairSessionInfo(analysis.symbol);
                     return (
                       <div
                         key={analysis.id}
                         className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                       >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="font-mono text-xs">{analysis.symbol}</Badge>
                              <Badge 
                                variant={analysis.strategy_type === '1H+4H' ? 'default' : 'secondary'} 
                                className="text-xs"
                              >
                                {analysis.strategy_type || '1H'}
                              </Badge>
                            </div>
                            
                            <div className="text-sm flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {analysis.ai_analysis.recommendation.action} - {
                                  analysis.ai_analysis.confidence?.combined 
                                    ? `${Math.round(analysis.ai_analysis.confidence.combined * 100)}%` 
                                    : `${analysis.ai_analysis.recommendation.confidence}%`
                                } confidence
                                {analysis.ai_analysis.confidence?.p_fill && (
                                  <span className="text-xs ml-1">
                                    (Fill: {Math.round(analysis.ai_analysis.confidence.p_fill * 100)}%)
                                  </span>
                                )}
                                {analysis.ai_analysis.recommendation.fundamentalsBias && (
                                  <Badge variant="outline" className="text-xs ml-1 px-1">
                                    📊 Fund
                                  </Badge>
                                )}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {new Date(analysis.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          
                          {/* Session Information and Actions */}
                          <div className="flex items-center justify-between sm:justify-end gap-2">
                            <Badge 
                              variant={
                                sessionInfo.priority === 'highest' ? 'destructive' :
                                sessionInfo.priority === 'high' ? 'default' :
                                sessionInfo.priority === 'upcoming' ? 'secondary' :
                                'outline'
                              }
                              className="text-xs flex items-center gap-1"
                            >
                              <Timer className="h-3 w-3" />
                              <span className="hidden sm:inline">
                                {sessionInfo.priority === 'upcoming' ? 'Upcoming' :
                                 sessionInfo.priority === 'highest' ? 'Peak Now' :
                                 sessionInfo.priority === 'high' ? 'Active' :
                                 sessionInfo.priority === 'medium' ? 'Good' : 'Low'}
                              </span>
                              <span className="sm:hidden">
                                {sessionInfo.priority === 'upcoming' ? 'Up' :
                                 sessionInfo.priority === 'highest' ? 'Peak' :
                                 sessionInfo.priority === 'high' ? 'Act' :
                                 sessionInfo.priority === 'medium' ? 'Ok' : 'Low'}
                              </span>
                            </Badge>
                            
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <Info className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md">
                                  <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                      <Clock className="h-5 w-5" />
                                      Session Info for {analysis.symbol}
                                    </DialogTitle>
                                  </DialogHeader>
                                  
                                  <div className="space-y-4">
                                    {/* Current Status */}
                                    <div className="p-3 bg-muted/50 rounded-lg">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium">Current Status</span>
                                        <Badge variant={sessionInfo.currentSession.status === 'active' ? 'default' : 'outline'}>
                                          {sessionInfo.currentSession.name}
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {sessionInfo.recommendation}
                                      </p>
                                    </div>
                                    
                                    {/* Next Session */}
                                    <div className="p-3 bg-muted/50 rounded-lg">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium">Next Optimal</span>
                                        <span className="text-sm font-mono">{sessionInfo.nextSession.time}</span>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {sessionInfo.nextSession.name} in {sessionInfo.nextSession.hoursUntil} hours
                                      </p>
                                    </div>
                                    
                                     {/* Trading Tip */}
                                     <div className="p-3 border border-primary/20 bg-primary/5 rounded-lg">
                                       <div className="flex items-start gap-2">
                                         <AlertTriangle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                         <div>
                                           <p className="text-sm font-medium text-primary">Trading Tip for {analysis.symbol}</p>
                                           <p className="text-xs text-muted-foreground mt-1">
                                             {sessionInfo.pairData.recommendation}
                                           </p>
                                           <div className="mt-2 space-y-1">
                                             <p className="text-xs text-muted-foreground">
                                               <span className="font-medium">Characteristics:</span> {sessionInfo.pairData.characteristics}
                                             </p>
                                             <p className="text-xs text-muted-foreground">
                                               <span className="font-medium">Volume:</span> {sessionInfo.pairData.optimalVolume}
                                             </p>
                                           </div>
                                         </div>
                                       </div>
                                     </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => loadAnalysis(analysis)}
                                className="h-8 text-xs"
                              >
                                <span className="hidden sm:inline">Load</span>
                                <Eye className="h-3 w-3 sm:hidden" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteAnalysis(analysis.id)}
                                className="h-8 text-xs text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                       </div>
                     );
                   })}
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

        {/* Enhanced Technical Indicators Display */}
        {analysisInputData?.technicalAnalysis && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Enhanced Technical Analysis
                {analysisInputData.technicalAnalysis.volatility && (
                  <Badge 
                    variant={
                      analysisInputData.technicalAnalysis.volatility.status === 'HIGH' ? 'destructive' :
                      analysisInputData.technicalAnalysis.volatility.status === 'MODERATE' ? 'default' :
                      'secondary'
                    }
                    className="ml-auto"
                  >
                    {analysisInputData.technicalAnalysis.volatility.status} Volatility
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Key Levels */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground">Support</h4>
                  <p className="text-lg font-bold text-buy">{analysisInputData.technicalAnalysis.support?.toFixed(5)}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground">Resistance</h4>
                  <p className="text-lg font-bold text-sell">{analysisInputData.technicalAnalysis.resistance?.toFixed(5)}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground">RSI (14)</h4>
                  <p className={`text-lg font-bold ${
                    analysisInputData.technicalAnalysis.rsi < 30 ? 'text-buy' :
                    analysisInputData.technicalAnalysis.rsi > 70 ? 'text-sell' :
                    'text-foreground'
                  }`}>
                    {analysisInputData.technicalAnalysis.rsi?.toFixed(1)}
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground">ATR</h4>
                  <p className="text-lg font-bold text-foreground">{analysisInputData.technicalAnalysis.atr?.toFixed(5)}</p>
                </div>
              </div>

              <Separator />

              {/* Volatility Analysis */}
              {analysisInputData.technicalAnalysis.volatility && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-base">Volatility Analysis</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">ATR Percentage</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xl font-bold">{analysisInputData.technicalAnalysis.volatility.atrPercentage}%</p>
                        <Badge variant={
                          analysisInputData.technicalAnalysis.volatility.atrPercentage > 0.6 ? 'destructive' :
                          analysisInputData.technicalAnalysis.volatility.atrPercentage > 0.3 ? 'default' :
                          'secondary'
                        }>
                          {analysisInputData.technicalAnalysis.volatility.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Bollinger Band Width</p>
                      <p className="text-xl font-bold">{analysisInputData.technicalAnalysis.volatility.bbandWidth}%</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Volatility Status</p>
                      <Badge variant={
                        analysisInputData.technicalAnalysis.volatility.status === 'HIGH' ? 'destructive' :
                        analysisInputData.technicalAnalysis.volatility.status === 'MODERATE' ? 'default' :
                        'secondary'
                      } className="text-sm">
                        {analysisInputData.technicalAnalysis.volatility.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              {/* Moving Averages & MACD */}
              <div className="space-y-4">
                <h4 className="font-semibold text-base">Momentum Indicators</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">SMA 10</p>
                    <p className="text-lg font-bold">{analysisInputData.technicalAnalysis.sma10?.toFixed(5)}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">SMA 20</p>
                    <p className="text-lg font-bold">{analysisInputData.technicalAnalysis.sma20?.toFixed(5)}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">MACD</p>
                    <p className={`text-lg font-bold ${
                      analysisInputData.technicalAnalysis.macd?.macd > 0 ? 'text-buy' : 'text-sell'
                    }`}>
                      {analysisInputData.technicalAnalysis.macd?.macd?.toFixed(5)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">MACD Signal</p>
                    <p className="text-lg font-bold">{analysisInputData.technicalAnalysis.macd?.signal?.toFixed(5)}</p>
                  </div>
                </div>
              </div>

              {/* Multi-timeframe Analysis */}
              {analysisInputData.technicalAnalysis.multiTimeframe && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h4 className="font-semibold text-base">Multi-Timeframe Analysis</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Confluence Score</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xl font-bold">{analysisInputData.technicalAnalysis.multiTimeframe.confluence}%</p>
                          <Badge variant={
                            analysisInputData.technicalAnalysis.multiTimeframe.confluence > 70 ? 'default' :
                            analysisInputData.technicalAnalysis.multiTimeframe.confluence > 50 ? 'secondary' :
                            'outline'
                          }>
                            {analysisInputData.technicalAnalysis.multiTimeframe.confluence > 70 ? 'Strong' :
                             analysisInputData.technicalAnalysis.multiTimeframe.confluence > 50 ? 'Moderate' : 'Weak'}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Trend Agreement</p>
                        <Badge variant={analysisInputData.technicalAnalysis.multiTimeframe.agreement ? 'default' : 'outline'}>
                          {analysisInputData.technicalAnalysis.multiTimeframe.agreement ? 'YES' : 'NO'}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">4H RSI</p>
                        <p className="text-lg font-bold">{analysisInputData.technicalAnalysis.multiTimeframe.higher4h?.rsi?.toFixed(1)}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Trading Recommendation */}
        {recommendation ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                AI Trading Recommendation
                <div className="ml-auto flex items-center gap-2">
                  {recommendation.aiProvider && (
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        recommendation.aiProvider === 'claude' 
                          ? 'border-purple-500 text-purple-700 dark:text-purple-300' 
                          : 'border-green-500 text-green-700 dark:text-green-300'
                      }`}
                    >
                      {recommendation.aiProvider === 'claude' ? 'Claude Opus 4.1' : (recommendation.aiModel === 'gpt-4.1-2025-04-14' ? 'GPT-4.1' : 'GPT-5')}
                    </Badge>
                  )}
                  <Badge 
                    variant={currentStrategy === '1H+4H' ? 'default' : 'secondary'} 
                  >
                    {currentStrategy} Strategy
                  </Badge>
                </div>
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
                  Confidence: <span className="font-semibold">
                    {confidenceScoring?.combined 
                      ? `${Math.round(confidenceScoring.combined * 100)}%` 
                      : `${recommendation.confidence}%`}
                  </span>
                  {confidenceScoring?.p_fill && (
                    <span className="ml-2 text-xs">
                      (Fill: {Math.round(confidenceScoring.p_fill * 100)}%)
                    </span>
                  )}
                </div>
                {recommendation.fundamentalsBias && (
                  <div className="text-xs text-muted-foreground mt-1">
                    <Badge variant="outline" className="text-xs px-2 py-0.5">
                      📊 Fundamentals: {recommendation.fundamentalsBias.overallBias} 
                      ({recommendation.fundamentalsBias.strength}/100)
                    </Badge>
                    {recommendation.fundamentalsBias.keyEvents?.length > 0 && (
                      <span className="ml-2">
                        Key: {recommendation.fundamentalsBias.keyEvents.slice(0, 2).join(", ")}
                      </span>
                    )}
                  </div>
                )}
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

                {recommendation.fundamentalsBias && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Fundamentals Impact</p>
                    <div className="bg-muted/50 p-3 rounded-lg border-l-4 border-primary">
                      <p className="text-sm leading-relaxed">{recommendation.fundamentalsBias.summary}</p>
                      {recommendation.fundamentalsBias.keyEvents?.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Key events: {recommendation.fundamentalsBias.keyEvents.slice(0, 3).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Entry Precision Engine Analysis */}
                {recommendation.entryPrecisionAnalysis && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium text-muted-foreground">Entry Precision Engine</p>
                      <Badge 
                        variant={
                          (recommendation.entryPrecisionAnalysis.consistencyScore || 0) >= 70 ? "default" : 
                          (recommendation.entryPrecisionAnalysis.consistencyScore || 0) >= 50 ? "secondary" : "outline"
                        }
                      >
                        {recommendation.entryPrecisionAnalysis.consistencyScore || 0}% Consistency
                      </Badge>
                    </div>
                    
                    <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                      {recommendation.selectedOption && (
                        <p className="text-sm font-medium text-foreground mb-2">
                          Selected: {recommendation.selectedOption}
                        </p>
                      )}
                      
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-muted-foreground">Available BUY Options</p>
                          <p className="font-medium">{recommendation.entryPrecisionAnalysis.buyOptions?.length || 0}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Available SELL Options</p>
                          <p className="font-medium">{recommendation.entryPrecisionAnalysis.sellOptions?.length || 0}</p>
                        </div>
                      </div>
                      
                      {(recommendation.entryPrecisionAnalysis.consistencyScore || 0) >= 70 && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                          <div className="h-1.5 w-1.5 bg-green-500 rounded-full"></div>
                          High precision - mathematically consistent levels
                        </div>
                      )}
                      {(recommendation.entryPrecisionAnalysis.consistencyScore || 0) < 50 && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-yellow-600">
                          <AlertTriangle className="h-3 w-3" />
                          Lower precision - increased uncertainty
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
                
                {analysisInputData.trendAnalysis && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2">Trend Analysis</h4>
                      <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                        {JSON.stringify(analysisInputData.trendAnalysis, null, 2)}
                      </pre>
                    </div>
                  </>
                )}
                
                {analysisInputData.marketSession && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2">Market Session Info</h4>
                      <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                        {JSON.stringify(analysisInputData.marketSession, null, 2)}
                      </pre>
                    </div>
                  </>
                )}
                
                <Separator />
                
                <div>
                  <h4 className="font-semibold mb-2">Historical Data ({analysisInputData.historicalData?.length || 0} candles)</h4>
                  <pre className="bg-muted p-3 rounded text-sm overflow-x-auto max-h-64">
                    {JSON.stringify(analysisInputData.historicalData, null, 2)}
                  </pre>
                </div>
                
                {analysisInputData.historical4hData && analysisInputData.historical4hData.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2">4H Historical Data ({analysisInputData.historical4hData?.length || 0} candles)</h4>
                      <pre className="bg-muted p-3 rounded text-sm overflow-x-auto max-h-64">
                        {JSON.stringify(analysisInputData.historical4hData, null, 2)}
                      </pre>
                    </div>
                  </>
                )}
                
                {analysisInputData.strategy && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2">Strategy Used</h4>
                      <Badge variant={analysisInputData.strategy === '1H+4H' ? 'default' : 'secondary'}>
                        {analysisInputData.strategy} Strategy
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-2">
                        {analysisInputData.strategy === '1H+4H' 
                          ? 'Enhanced multi-timeframe analysis using both 1H and 4H data points'
                          : 'Standard analysis using 1H timeframe data only'
                        }
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            )}
          </Card>
        )}
          </TabsContent>

          <TabsContent value="auto-trading">
              <AutoTradingPanel />
          </TabsContent>

          <TabsContent value="usd-fundamentals">
            <USDFundamentals />
          </TabsContent>

          <TabsContent value="sessions">
            <MarketSessions />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
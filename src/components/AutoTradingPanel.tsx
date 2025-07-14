import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TrendingUp, TrendingDown, Clock, Target, AlertTriangle, Play, Pause } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchMarketData, analyzeTradingOpportunity } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";

interface AutoTrade {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  session_name: string;
  status: 'OPEN' | 'WIN' | 'LOSS';
  pips_result?: number;
  created_at: string;
  closed_at?: string;
  next_check_at?: string;
}

interface SessionConfig {
  name: string;
  pairs: string[];
  startHour: number;
  description: string;
}

const SESSION_CONFIGS: SessionConfig[] = [
  {
    name: 'Asian Session',
    pairs: ['GBP/JPY'],
    startHour: 2,
    description: 'Focus on JPY volatility'
  },
  {
    name: 'London Session',
    pairs: ['GBP/USD', 'GBP/JPY'],
    startHour: 10,
    description: 'GBP pairs are most active'
  },
  {
    name: 'New York Session',
    pairs: ['EUR/USD'],
    startHour: 15,
    description: 'USD pairs momentum'
  }
];

export function AutoTradingPanel() {
  const { toast } = useToast();
  const [isAutoTradingEnabled, setIsAutoTradingEnabled] = useState(false);
  const [activeTrades, setActiveTrades] = useState<AutoTrade[]>([]);
  const [completedTrades, setCompletedTrades] = useState<AutoTrade[]>([]);
  const [isGeneratingTrade, setIsGeneratingTrade] = useState(false);
  const [nextTradeGeneration, setNextTradeGeneration] = useState<string>('');

  const getRomaniaHour = () => {
    return parseInt(new Date().toLocaleString('en-US', {
      timeZone: 'Europe/Bucharest',
      hour: '2-digit',
      hour12: false
    }));
  };

  const getNextSessionTime = () => {
    const currentHour = getRomaniaHour();
    const today = new Date();
    
    for (const session of SESSION_CONFIGS) {
      if (currentHour < session.startHour) {
        const nextTime = new Date(today);
        nextTime.setHours(session.startHour, 0, 0, 0);
        return {
          session: session.name,
          time: nextTime,
          pairs: session.pairs
        };
      }
    }
    
    // Next day first session
    const nextDay = new Date(today);
    nextDay.setDate(today.getDate() + 1);
    nextDay.setHours(SESSION_CONFIGS[0].startHour, 0, 0, 0);
    
    return {
      session: SESSION_CONFIGS[0].name,
      time: nextDay,
      pairs: SESSION_CONFIGS[0].pairs
    };
  };

  const calculatePips = (entry: number, current: number, action: 'BUY' | 'SELL', symbol: string) => {
    const pipMultiplier = symbol.includes('JPY') ? 100 : 10000;
    const difference = action === 'BUY' ? current - entry : entry - current;
    return Math.round(difference * pipMultiplier);
  };

  const generateTradeForPair = async (symbol: string, sessionName: string) => {
    try {
      const marketDataResponse = await fetchMarketData(symbol, '1H');
      const analysisResponse = await analyzeTradingOpportunity(
        symbol,
        marketDataResponse.historicalData,
        marketDataResponse.currentData,
        null,
        '1H'
      );

      if (analysisResponse.recommendation) {
        const rec = analysisResponse.recommendation;
        
        // Calculate next check time (3 hours from now)
        const nextCheck = new Date();
        nextCheck.setHours(nextCheck.getHours() + 3);

        const { data: trade, error } = await supabase
          .from('auto_trades')
          .insert({
            symbol,
            action: rec.action,
            entry_price: rec.entry,
            stop_loss: rec.stopLoss,
            take_profit: rec.takeProfit,
            session_name: sessionName,
            next_check_at: nextCheck.toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        toast({
          title: "Auto Trade Generated",
          description: `${rec.action} ${symbol} at ${rec.entry} for ${sessionName}`,
        });

        return trade;
      }
    } catch (error) {
      console.error(`Failed to generate trade for ${symbol}:`, error);
      toast({
        title: "Trade Generation Failed",
        description: `Could not generate trade for ${symbol}`,
        variant: "destructive",
      });
    }
    return null;
  };

  const generateSessionTrades = async () => {
    if (!isAutoTradingEnabled) return;

    setIsGeneratingTrade(true);
    const currentHour = getRomaniaHour();
    const currentMinute = parseInt(new Date().toLocaleString('en-US', {
      timeZone: 'Europe/Bucharest',
      minute: '2-digit'
    }));
    
    // Generate trades within first 15 minutes of session start
    const activeSession = SESSION_CONFIGS.find(session => 
      session.startHour === currentHour && currentMinute <= 15
    );
    
    if (activeSession) {
      console.log(`Generating trades for ${activeSession.name}`);
      
      // Check if we already have trades for this session today
      const today = new Date().toISOString().split('T')[0];
      const { data: existingTrades } = await supabase
        .from('auto_trades')
        .select('id')
        .eq('session_name', activeSession.name)
        .gte('created_at', today + 'T00:00:00.000Z')
        .lt('created_at', today + 'T23:59:59.999Z');
      
      if (!existingTrades || existingTrades.length === 0) {
        for (const symbol of activeSession.pairs) {
          await generateTradeForPair(symbol, activeSession.name);
        }
        
        await loadTrades();
      }
    }
    
    setIsGeneratingTrade(false);
  };

  const checkTrades = async () => {
    if (activeTrades.length === 0) return;

    for (const trade of activeTrades) {
      try {
        const marketDataResponse = await fetchMarketData(trade.symbol, '1H');
        const currentPrice = marketDataResponse.currentData.price;

        // Check if trade hit SL or TP
        let tradeStatus = trade.status;
        let pipsResult = 0;

        if (trade.action === 'BUY') {
          if (currentPrice <= trade.stop_loss) {
            tradeStatus = 'LOSS';
            pipsResult = calculatePips(trade.entry_price, trade.stop_loss, trade.action, trade.symbol);
          } else if (currentPrice >= trade.take_profit) {
            tradeStatus = 'WIN';
            pipsResult = calculatePips(trade.entry_price, trade.take_profit, trade.action, trade.symbol);
          }
        } else { // SELL
          if (currentPrice >= trade.stop_loss) {
            tradeStatus = 'LOSS';
            pipsResult = calculatePips(trade.entry_price, trade.stop_loss, trade.action, trade.symbol);
          } else if (currentPrice <= trade.take_profit) {
            tradeStatus = 'WIN';
            pipsResult = calculatePips(trade.entry_price, trade.take_profit, trade.action, trade.symbol);
          }
        }

        if (tradeStatus !== 'OPEN') {
          const { error } = await supabase
            .from('auto_trades')
            .update({
              status: tradeStatus,
              pips_result: pipsResult,
              closed_at: new Date().toISOString()
            })
            .eq('id', trade.id);

          if (!error) {
            toast({
              title: `Trade ${tradeStatus}`,
              description: `${trade.symbol} ${trade.action} ${tradeStatus === 'WIN' ? '+' : ''}${pipsResult} pips`,
              variant: tradeStatus === 'WIN' ? "default" : "destructive",
            });
          }
        } else {
          // Update next check time
          const nextCheck = new Date();
          nextCheck.setHours(nextCheck.getHours() + 3);
          
          await supabase
            .from('auto_trades')
            .update({ next_check_at: nextCheck.toISOString() })
            .eq('id', trade.id);
        }
      } catch (error) {
        console.error(`Failed to check trade ${trade.id}:`, error);
      }
    }

    await loadTrades();
  };

  const loadTrades = async () => {
    try {
      const { data: trades, error } = await supabase
        .from('auto_trades')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setActiveTrades(trades?.filter(t => t.status === 'OPEN') as AutoTrade[] || []);
      setCompletedTrades(trades?.filter(t => t.status !== 'OPEN') as AutoTrade[] || []);
    } catch (error) {
      console.error('Failed to load trades:', error);
    }
  };

  const updateNextTradeTime = () => {
    const next = getNextSessionTime();
    const timeString = next.time.toLocaleString('en-US', {
      timeZone: 'Europe/Bucharest',
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      day: 'numeric'
    });
    setNextTradeGeneration(`${next.session} - ${timeString}`);
  };

  useEffect(() => {
    loadTrades();
    updateNextTradeTime();
    
    const interval = setInterval(() => {
      updateNextTradeTime();
      if (isAutoTradingEnabled) {
        generateSessionTrades();
        checkTrades();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [isAutoTradingEnabled, activeTrades.length]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'WIN': return 'default';
      case 'LOSS': return 'destructive';
      default: return 'secondary';
    }
  };

  const totalPips = completedTrades.reduce((sum, trade) => sum + (trade.pips_result || 0), 0);
  const winCount = completedTrades.filter(t => t.status === 'WIN').length;
  const lossCount = completedTrades.filter(t => t.status === 'LOSS').length;
  const winRate = completedTrades.length > 0 ? (winCount / completedTrades.length * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Auto Trading System
            <div className="flex items-center space-x-2">
              <Label htmlFor="auto-trading">Auto Trading</Label>
              <Switch
                id="auto-trading"
                checked={isAutoTradingEnabled}
                onCheckedChange={setIsAutoTradingEnabled}
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{totalPips}</div>
              <p className="text-sm text-muted-foreground">Total Pips</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{winRate}%</div>
              <p className="text-sm text-muted-foreground">Win Rate</p>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Next Generation</div>
              <p className="font-semibold">{nextTradeGeneration}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Trades */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Active Trades ({activeTrades.length})
            {isGeneratingTrade && <Clock className="h-4 w-4 animate-spin" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activeTrades.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No active trades</p>
            ) : (
              activeTrades.map((trade) => (
                <div key={trade.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {trade.action === 'BUY' ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <div>
                      <div className="font-semibold">{trade.symbol}</div>
                      <div className="text-sm text-muted-foreground">{trade.session_name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">Entry: {trade.entry_price}</div>
                    <div className="text-xs text-muted-foreground">
                      SL: {trade.stop_loss} | TP: {trade.take_profit}
                    </div>
                  </div>
                  <Badge variant="secondary">OPEN</Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Completed Trades */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Completed Trades ({completedTrades.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {completedTrades.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No completed trades</p>
            ) : (
              completedTrades.map((trade) => (
                <div key={trade.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {trade.action === 'BUY' ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <div>
                      <div className="font-semibold">{trade.symbol}</div>
                      <div className="text-sm text-muted-foreground">{trade.session_name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">Entry: {trade.entry_price}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(trade.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={getStatusBadgeVariant(trade.status)}>
                      {trade.status}
                    </Badge>
                    <div className={`text-sm font-semibold ${
                      (trade.pips_result || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {(trade.pips_result || 0) > 0 ? '+' : ''}{trade.pips_result} pips
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Session Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Session Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {SESSION_CONFIGS.map((session) => (
              <div key={session.name} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-semibold">{session.name}</div>
                  <div className="text-sm text-muted-foreground">{session.description}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{session.startHour}:00 Romania Time</div>
                  <div className="text-xs text-muted-foreground">
                    Pairs: {session.pairs.join(', ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
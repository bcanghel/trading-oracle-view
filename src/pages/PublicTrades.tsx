import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, BarChart3, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PublicAutoTrade {
  symbol: string | null;
  action: string | null;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  status: string | null;
  pips_result: number | null;
  lot_size: number | null;
  calculated_micro_lots: number | null;
  ai_confidence: number | null;
  risk_reward_ratio: number | null;
  session_name: string | null;
  created_at: string | null;
  closed_at: string | null;
}

const SESSION_CONFIGS = [
  { name: "Asian Session", pairs: ["AUD/JPY", "NZD/JPY"], startHour: 1, description: "Tokyo market hours" },
  { name: "London Session", pairs: ["GBP/USD", "EUR/USD", "GBP/JPY"], startHour: 9, description: "London market hours" },
  { name: "New York Session", pairs: ["USD/JPY", "USD/CAD", "GBP/AUD"], startHour: 15, description: "New York market hours" }
];

const getStatusBadgeVariant = (status: string | null) => {
  switch (status) {
    case 'WIN': return 'default';
    case 'LOSS': return 'destructive';
    case 'OPEN': return 'secondary';
    default: return 'outline';
  }
};

const getRomaniaHour = () => {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "Europe/Bucharest" })).getHours();
};

const getNextSessionTime = () => {
  const currentHour = getRomaniaHour();
  
  for (const session of SESSION_CONFIGS) {
    if (currentHour < session.startHour) {
      const hoursUntil = session.startHour - currentHour;
      return `${session.name} in ${hoursUntil}h`;
    }
  }
  
  const tomorrow = SESSION_CONFIGS[0];
  const hoursUntil = (24 - currentHour) + tomorrow.startHour;
  return `${tomorrow.name} in ${hoursUntil}h`;
};

const PublicTrades = () => {
  const [trades, setTrades] = useState<PublicAutoTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextSession, setNextSession] = useState('');

  const activeTrades = trades.filter(trade => trade.status === 'OPEN');
  const completedTrades = trades.filter(trade => trade.status !== 'OPEN');
  
  const totalPips = completedTrades.reduce((sum, trade) => sum + (trade.pips_result || 0), 0);
  const winningTrades = completedTrades.filter(trade => (trade.pips_result || 0) > 0);
  const winRate = completedTrades.length > 0 ? (winningTrades.length / completedTrades.length * 100) : 0;

  const loadTrades = async () => {
    try {
      const { data, error } = await supabase
        .from('public_auto_trades_stats')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading trades:', error);
      } else {
        setTrades(data || []);
      }
    } catch (error) {
      console.error('Error loading trades:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrades();
    setNextSession(getNextSessionTime());
    
    const interval = setInterval(() => {
      setNextSession(getNextSessionTime());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Loading trades...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Auto Trading Monitor</h1>
          <p className="text-muted-foreground">Real-time view of automated trading performance</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Pips</p>
                  <p className={`text-xl font-bold ${totalPips >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalPips > 0 ? '+' : ''}{totalPips}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Win Rate</p>
                  <p className="text-xl font-bold">{winRate.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Trades</p>
                  <p className="text-xl font-bold">{completedTrades.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Next Session</p>
                  <p className="text-lg font-semibold">{nextSession}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Trades */}
        <Card>
          <CardHeader>
            <CardTitle>Active Trades ({activeTrades.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeTrades.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No active trades</p>
              ) : (
                activeTrades.map((trade, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    {/* Header with symbol and action */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {trade.action === 'BUY' ? (
                          <TrendingUp className="h-5 w-5 text-green-600" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-red-600" />
                        )}
                        <div>
                          <div className="font-bold text-lg">{trade.symbol}</div>
                          <div className="text-sm text-muted-foreground">{trade.session_name}</div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-sm px-3 py-1">OPEN</Badge>
                    </div>
                    
                    {/* Price information */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
                      <div className="text-center sm:text-left">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Entry</div>
                        <div className="font-semibold text-base">{trade.entry_price}</div>
                      </div>
                      <div className="text-center sm:text-left">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Stop Loss</div>
                        <div className="font-semibold text-base text-red-600">{trade.stop_loss}</div>
                      </div>
                      <div className="text-center sm:text-left">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Take Profit</div>
                        <div className="font-semibold text-base text-green-600">{trade.take_profit}</div>
                      </div>
                    </div>
                    
                    {/* Lot size information */}
                    {(trade.calculated_micro_lots || trade.lot_size) && (
                      <div className="flex justify-center sm:justify-start pt-2">
                        <div className="bg-blue-50 dark:bg-blue-950 px-3 py-1 rounded-full">
                          <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                            Lot: {trade.lot_size || 0} ({trade.calculated_micro_lots || 0} micro)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Trade History */}
        <Card>
          <CardHeader>
            <CardTitle>Trade History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {completedTrades.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No completed trades</p>
              ) : (
                completedTrades.map((trade, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
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
                        {trade.created_at && new Date(trade.created_at).toLocaleDateString()}
                      </div>
                      {(trade.calculated_micro_lots || trade.lot_size) && (
                        <div className="text-xs text-blue-600 font-medium">
                          Lot: {trade.lot_size || 0} ({trade.calculated_micro_lots || 0} micro)
                        </div>
                      )}
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
            <CardTitle>Trading Sessions</CardTitle>
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
    </div>
  );
};

export default PublicTrades;
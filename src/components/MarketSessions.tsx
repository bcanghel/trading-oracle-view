import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, TrendingUp, Volume2, Globe, AlertCircle } from 'lucide-react';

interface SessionInfo {
  name: string;
  startTime: string;
  endTime: string;
  peakTime: string;
  status: 'active' | 'upcoming' | 'closed';
  volumeMultiplier: number;
  characteristics: string[];
  reasons: string[];
  pairs: string[];
}

export function MarketSessions() {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    
    return () => clearInterval(timer);
  }, []);

  const getRomaniaTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      timeZone: 'Europe/Bucharest',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const getRomaniaHour = (date: Date) => {
    return parseInt(date.toLocaleString('en-US', {
      timeZone: 'Europe/Bucharest',
      hour: '2-digit',
      hour12: false
    }));
  };

  const getSessionStatus = (startHour: number, endHour: number): 'active' | 'upcoming' | 'closed' => {
    const currentHour = getRomaniaHour(currentTime);
    
    if (endHour < startHour) { // Session crosses midnight
      if (currentHour >= startHour || currentHour < endHour) return 'active';
    } else {
      if (currentHour >= startHour && currentHour < endHour) return 'active';
    }
    
    // Check if upcoming (within 2 hours)
    const hoursUntilStart = startHour > currentHour ? startHour - currentHour : (24 - currentHour) + startHour;
    if (hoursUntilStart <= 2) return 'upcoming';
    
    return 'closed';
  };

  const sessions: SessionInfo[] = [
    {
      name: 'Asian Session',
      startTime: '02:00',
      endTime: '11:00',
      peakTime: '05:00 - 08:00',
      status: getSessionStatus(2, 11),
      volumeMultiplier: 0.8,
      characteristics: ['Lower Volatility', 'Ranging Markets', 'JPY Pairs Active'],
      reasons: [
        'Best for range trading strategies',
        'Lower spreads on JPY pairs',
        'Consolidation after NY close',
        'Good for position building'
      ],
      pairs: ['USD/JPY', 'AUD/USD', 'NZD/USD', 'AUD/JPY']
    },
    {
      name: 'London Session',
      startTime: '10:00',
      endTime: '19:00',
      peakTime: '10:00 - 12:00',
      status: getSessionStatus(10, 19),
      volumeMultiplier: 1.5,
      characteristics: ['High Volatility', 'Trend Breakouts', 'EUR/GBP Focus'],
      reasons: [
        'Highest liquidity for EUR pairs',
        'Major economic news releases',
        'Strong trending moves',
        'Best breakout opportunities'
      ],
      pairs: ['EUR/USD', 'GBP/USD', 'EUR/GBP', 'USD/CHF']
    },
    {
      name: 'London-NY Overlap',
      startTime: '15:00',
      endTime: '19:00',
      peakTime: '15:30 - 17:30',
      status: getSessionStatus(15, 19),
      volumeMultiplier: 2.0,
      characteristics: ['Maximum Liquidity', 'Highest Volume', 'All Pairs Active'],
      reasons: [
        'Peak trading volume globally',
        'Tightest spreads available',
        'Maximum price movements',
        'Best execution for large trades',
        'Major news impact amplified'
      ],
      pairs: ['All Major Pairs', 'EUR/USD', 'GBP/USD', 'USD/JPY']
    },
    {
      name: 'New York Session',
      startTime: '15:00',
      endTime: '00:00',
      peakTime: '15:00 - 18:00',
      status: getSessionStatus(15, 24),
      volumeMultiplier: 1.7,
      characteristics: ['USD Strength', 'News Impact', 'Momentum Moves'],
      reasons: [
        'US economic data releases',
        'Federal Reserve announcements',
        'Strong USD pair movements',
        'End-of-day position adjustments'
      ],
      pairs: ['USD/CAD', 'EUR/USD', 'GBP/USD', 'USD/JPY']
    }
  ];

  const getOptimalEntryTimes = () => {
    const currentHour = getRomaniaHour(currentTime);
    const times = [];

    // London Open
    if (currentHour < 10) {
      times.push({
        time: '10:00',
        session: 'London Open',
        reason: 'European markets open, high volatility expected',
        priority: 'high'
      });
    }

    // London-NY Overlap
    if (currentHour < 15) {
      times.push({
        time: '15:00',
        session: 'London-NY Overlap',
        reason: 'Peak global liquidity, maximum volume',
        priority: 'highest'
      });
    }

    // End of London session
    if (currentHour < 19) {
      times.push({
        time: '18:30',
        session: 'London Close',
        reason: 'Position adjustments before London close',
        priority: 'medium'
      });
    }

    // Next day's Asian session
    times.push({
      time: '02:00 (Next Day)',
      session: 'Asian Open',
      reason: 'Range trading opportunities, JPY pairs',
      priority: 'low'
    });

    return times;
  };

  const optimalTimes = getOptimalEntryTimes();

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'highest': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'upcoming': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Current Time Display */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Clock className="h-5 w-5" />
              Current Romania Time
            </CardTitle>
            <div className="text-3xl font-mono font-bold text-primary bg-background/50 px-4 py-2 rounded-lg">
              {getRomaniaTime(currentTime)}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Optimal Entry Times */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Optimal Entry Times Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {optimalTimes.map((entry, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono font-bold text-xl text-foreground">{entry.time}</span>
                    <Badge variant={getPriorityBadgeVariant(entry.priority)}>
                      {entry.session}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{entry.reason}</p>
                </div>
                <div className={`w-3 h-3 rounded-full ${
                  entry.priority === 'highest' ? 'bg-destructive' :
                  entry.priority === 'high' ? 'bg-primary' :
                  entry.priority === 'medium' ? 'bg-secondary' :
                  'bg-muted-foreground'
                }`} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Market Sessions Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {sessions.map((session) => (
          <Card key={session.name} className={`relative overflow-hidden transition-all hover:shadow-lg ${
            session.status === 'active' ? 'ring-2 ring-primary/50 bg-primary/5' : ''
          }`}>
            <div className={`absolute top-0 left-0 w-1 h-full ${
              session.status === 'active' ? 'bg-primary' :
              session.status === 'upcoming' ? 'bg-secondary' :
              'bg-muted'
            }`} />
            
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  {session.name}
                </CardTitle>
                <Badge variant={getStatusBadgeVariant(session.status)}>
                  {session.status}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Time Information */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block">Session</span>
                  <span className="font-mono font-medium">{session.startTime} - {session.endTime}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Peak</span>
                  <span className="font-mono font-medium text-primary">{session.peakTime}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm bg-muted/50 p-3 rounded-lg">
                <span className="text-muted-foreground">Volume Multiplier</span>
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-primary" />
                  <span className="font-bold text-primary">{session.volumeMultiplier}x</span>
                </div>
              </div>

              {/* Characteristics */}
              <div>
                <h4 className="text-sm font-medium mb-2 text-muted-foreground">Market Characteristics</h4>
                <div className="flex flex-wrap gap-2">
                  {session.characteristics.map((char, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {char}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Trading Reasons */}
              <div>
                <h4 className="text-sm font-medium mb-2 text-muted-foreground">Trading Advantages</h4>
                <div className="space-y-1">
                  {session.reasons.slice(0, 2).map((reason, index) => (
                    <div key={index} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <div className="w-1 h-1 bg-primary rounded-full mt-2 flex-shrink-0" />
                      {reason}
                    </div>
                  ))}
                </div>
              </div>

              {/* Best Pairs */}
              <div>
                <h4 className="text-sm font-medium mb-2 text-muted-foreground">Focus Pairs</h4>
                <div className="flex flex-wrap gap-1">
                  {session.pairs.slice(0, 3).map((pair, index) => (
                    <Badge key={index} variant="secondary" className="text-xs font-mono">
                      {pair}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Session Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            24-Hour Session Timeline (Romania Time)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative h-20 bg-muted/30 rounded-lg overflow-hidden border">
            {/* Asian Session */}
            <div className="absolute h-6 bg-blue-500/60 rounded top-2 border border-blue-500/40"
                 style={{ left: '8.33%', width: '37.5%' }}>
              <span className="text-xs text-white font-medium pl-2 pt-1 block">Asian</span>
            </div>
            
            {/* London Session */}
            <div className="absolute h-6 bg-green-500/60 rounded top-9 border border-green-500/40"
                 style={{ left: '41.67%', width: '37.5%' }}>
              <span className="text-xs text-white font-medium pl-2 pt-1 block">London</span>
            </div>
            
            {/* NY Session */}
            <div className="absolute h-6 bg-purple-500/60 rounded bottom-2 border border-purple-500/40"
                 style={{ left: '62.5%', width: '37.5%' }}>
              <span className="text-xs text-white font-medium pl-2 pt-1 block">New York</span>
            </div>
            
            {/* Time markers */}
            {[0, 6, 12, 18].map((hour, index) => (
              <div key={hour} className="absolute top-0 h-full w-px bg-border" style={{ left: `${(hour / 24) * 100}%` }}>
                <span className="absolute -bottom-6 -left-4 text-xs text-muted-foreground font-mono">
                  {hour.toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
            
            {/* Current time indicator */}
            <div 
              className="absolute top-0 h-full w-0.5 bg-destructive z-10 animate-pulse"
              style={{ left: `${(getRomaniaHour(currentTime) / 24) * 100}%` }}
            >
              <div className="absolute -top-2 -left-2 w-4 h-4 bg-destructive rounded-full border-2 border-background" />
              <span className="absolute -bottom-6 -left-6 text-xs font-mono font-bold text-destructive">
                NOW
              </span>
            </div>
          </div>
          
          <div className="mt-8 flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500/60 border border-blue-500/40 rounded" />
              <span>Asian Session</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500/60 border border-green-500/40 rounded" />
              <span>London Session</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-500/60 border border-purple-500/40 rounded" />
              <span>New York Session</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-destructive rounded" />
              <span>Current Time</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
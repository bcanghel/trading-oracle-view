import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, TrendingUp, Volume2, Globe } from 'lucide-react';

interface SessionInfo {
  name: string;
  startTime: string;
  endTime: string;
  peakTime: string;
  status: 'active' | 'upcoming' | 'closed';
  volumeMultiplier: number;
  characteristics: string[];
  reasons: string[];
  color: string;
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
      color: 'bg-blue-500',
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
      color: 'bg-green-500',
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
      color: 'bg-red-500',
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
      color: 'bg-purple-500',
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

  return (
    <div className="space-y-6">
      {/* Current Time Display */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Current Romania Time
            </CardTitle>
            <div className="text-2xl font-mono font-bold text-primary">
              {getRomaniaTime(currentTime)}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Optimal Entry Times */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Optimal Entry Times Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {optimalTimes.map((entry, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  entry.priority === 'highest' ? 'bg-red-50 border-red-200' :
                  entry.priority === 'high' ? 'bg-orange-50 border-orange-200' :
                  entry.priority === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-blue-50 border-blue-200'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-lg">{entry.time}</span>
                    <Badge variant={
                      entry.priority === 'highest' ? 'destructive' :
                      entry.priority === 'high' ? 'default' :
                      entry.priority === 'medium' ? 'secondary' :
                      'outline'
                    }>
                      {entry.session}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{entry.reason}</p>
                </div>
                <div className={`w-3 h-3 rounded-full ${
                  entry.priority === 'highest' ? 'bg-red-500' :
                  entry.priority === 'high' ? 'bg-orange-500' :
                  entry.priority === 'medium' ? 'bg-yellow-500' :
                  'bg-blue-500'
                }`} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Market Sessions */}
      <div className="grid gap-4 md:grid-cols-2">
        {sessions.map((session) => (
          <Card key={session.name} className="relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${session.color}`} />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  {session.name}
                </CardTitle>
                <Badge variant={
                  session.status === 'active' ? 'default' :
                  session.status === 'upcoming' ? 'secondary' :
                  'outline'
                }>
                  {session.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Time Information */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Session:</span>
                  <span className="font-mono">{session.startTime} - {session.endTime}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Peak:</span>
                  <span className="font-mono font-medium">{session.peakTime}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Volume:</span>
                  <div className="flex items-center gap-1">
                    <Volume2 className="h-3 w-3" />
                    <span>{session.volumeMultiplier}x</span>
                  </div>
                </div>
              </div>

              {/* Characteristics */}
              <div>
                <h4 className="text-sm font-medium mb-2">Characteristics</h4>
                <div className="flex flex-wrap gap-1">
                  {session.characteristics.map((char, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {char}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Trading Reasons */}
              <div>
                <h4 className="text-sm font-medium mb-2">Why Trade This Session</h4>
                <ul className="space-y-1">
                  {session.reasons.map((reason, index) => (
                    <li key={index} className="text-xs text-muted-foreground flex items-start gap-1">
                      <span className="text-primary mt-1">•</span>
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Best Pairs */}
              <div>
                <h4 className="text-sm font-medium mb-2">Focus Pairs</h4>
                <div className="flex flex-wrap gap-1">
                  {session.pairs.map((pair, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {pair}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Session Overlap Visual */}
      <Card>
        <CardHeader>
          <CardTitle>24-Hour Session Timeline (Romania Time)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative h-16 bg-muted rounded-lg overflow-hidden">
            {/* Asian Session */}
            <div className="absolute h-4 bg-blue-500 opacity-60 top-2"
                 style={{ left: '8.33%', width: '37.5%' }} />
            {/* London Session */}
            <div className="absolute h-4 bg-green-500 opacity-60 top-6"
                 style={{ left: '41.67%', width: '37.5%' }} />
            {/* NY Session */}
            <div className="absolute h-4 bg-purple-500 opacity-60 top-10"
                 style={{ left: '62.5%', width: '37.5%' }} />
            
            {/* Time markers */}
            <div className="absolute top-0 h-full w-px bg-border" style={{ left: '0%' }}>
              <span className="absolute -bottom-6 -left-4 text-xs">00:00</span>
            </div>
            <div className="absolute top-0 h-full w-px bg-border" style={{ left: '25%' }}>
              <span className="absolute -bottom-6 -left-4 text-xs">06:00</span>
            </div>
            <div className="absolute top-0 h-full w-px bg-border" style={{ left: '50%' }}>
              <span className="absolute -bottom-6 -left-4 text-xs">12:00</span>
            </div>
            <div className="absolute top-0 h-full w-px bg-border" style={{ left: '75%' }}>
              <span className="absolute -bottom-6 -left-4 text-xs">18:00</span>
            </div>
            
            {/* Current time indicator */}
            <div 
              className="absolute top-0 h-full w-0.5 bg-red-500 z-10"
              style={{ left: `${(getRomaniaHour(currentTime) / 24) * 100}%` }}
            >
              <div className="absolute -top-2 -left-2 w-4 h-4 bg-red-500 rounded-full" />
            </div>
          </div>
          <div className="mt-6 flex gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 rounded" />
              <span>Asian</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded" />
              <span>London</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-purple-500 rounded" />
              <span>New York</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded" />
              <span>Current Time</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
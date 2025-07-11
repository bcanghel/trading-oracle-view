export function getMarketSession(romaniaHour: number) {
  // Market sessions in Romania time (UTC+2/+3)
  const sessions = [
    {
      name: 'Sydney Session',
      start: 0, end: 9,
      volatility: 'Low',
      recommendation: 'Conservative entries, wait for clear signals'
    },
    {
      name: 'Tokyo Session', 
      start: 2, end: 11,
      volatility: 'Medium',
      recommendation: 'Focus on JPY pairs, moderate volatility'
    },
    {
      name: 'London Session',
      start: 10, end: 19,
      volatility: 'High', 
      recommendation: 'High volatility, good for breakouts'
    },
    {
      name: 'New York Session',
      start: 15, end: 24,
      volatility: 'High',
      recommendation: 'USD pairs active, trend following'
    }
  ];

  // Find active sessions
  const activeSessions = sessions.filter(session => {
    if (session.end > 24) {
      return romaniaHour >= session.start || romaniaHour <= (session.end - 24);
    }
    return romaniaHour >= session.start && romaniaHour < session.end;
  });

  // Check for overlap periods (higher volatility)
  const isLondonNYOverlap = romaniaHour >= 15 && romaniaHour < 19;
  const isTokyoLondonOverlap = romaniaHour >= 10 && romaniaHour < 11;

  if (isLondonNYOverlap) {
    return {
      name: 'London-New York Overlap',
      status: 'High Activity',
      volatility: 'Very High',
      recommendation: 'Prime trading time - aggressive entries possible, major news impact'
    };
  }

  if (isTokyoLondonOverlap) {
    return {
      name: 'Tokyo-London Overlap', 
      status: 'Medium Activity',
      volatility: 'Medium-High',
      recommendation: 'Good for EUR/JPY, GBP/JPY pairs'
    };
  }

  if (activeSessions.length > 0) {
    const primarySession = activeSessions[0];
    return {
      name: primarySession.name,
      status: 'Active',
      volatility: primarySession.volatility,
      recommendation: primarySession.recommendation
    };
  }

  return {
    name: 'Market Closed',
    status: 'Low Activity',
    volatility: 'Very Low', 
    recommendation: 'Avoid trading, wait for market open'
  };
}
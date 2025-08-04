// Check current Romania time and session configurations
const getRomaniaTime = () => {
  const now = new Date();
  const romaniaTime = new Date(now.toLocaleString('en-US', {
    timeZone: 'Europe/Bucharest'
  }));
  
  return {
    hour: parseInt(romaniaTime.toLocaleString('en-US', {
      timeZone: 'Europe/Bucharest',
      hour: '2-digit',
      hour12: false
    })),
    minute: parseInt(romaniaTime.toLocaleString('en-US', {
      timeZone: 'Europe/Bucharest',
      minute: '2-digit'
    })),
    full: romaniaTime.toLocaleString('en-US', {
      timeZone: 'Europe/Bucharest',
      hour12: false
    })
  };
};

const SESSION_CONFIGS = [
  {
    name: 'Asian Session',
    pairs: ['GBP/AUD'],
    startHour: 2,
  },
  {
    name: 'London Session',
    pairs: ['GBP/USD'],
    startHour: 10,
  },
  {
    name: 'New York Session',
    pairs: ['EUR/USD'],
    startHour: 15,
  }
];

const romaniaTime = getRomaniaTime();
console.log('Current Romania Time:', romaniaTime);

// Check which session should be active
const activeSession = SESSION_CONFIGS.find(session => 
  session.startHour === romaniaTime.hour && romaniaTime.minute <= 15
);

console.log('Active Session:', activeSession || 'None');
console.log('Next session times:', SESSION_CONFIGS.map(s => `${s.name}: ${s.startHour}:00`));

// Check if we're in a trading window
const isInTradingWindow = SESSION_CONFIGS.some(session => 
  session.startHour === romaniaTime.hour && romaniaTime.minute <= 15
);

console.log('Is in trading window (first 15 minutes of session):', isInTradingWindow);
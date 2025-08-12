# MT5 Integration for macOS

This directory contains the complete MT5 integration setup for macOS, including the Expert Advisor and webhook server.

## Files Overview

- `AutoTradingReceiver.mq5` - Expert Advisor for MT5
- `webhook-server.js` - Node.js webhook server
- `package.json` - Node.js dependencies
- `setup-guide.md` - Detailed setup instructions

## Quick Setup

1. **Install Node.js dependencies:**
   ```bash
   cd mt5-integration
   npm install
   ```

2. **Start the webhook server:**
   ```bash
   npm start
   ```

3. **Install the Expert Advisor in MT5:**
   - Copy `AutoTradingReceiver.mq5` to your MT5 Experts folder
   - Compile and attach to any chart
   - Enable WebRequest for localhost in MT5 settings

4. **Configure Lovable Auto Trading:**
   - Set webhook URL to: `http://localhost:8080/webhook`
   - Test the connection

## How It Works

1. **Lovable System** → Supabase trigger detects trade changes
2. **Supabase Edge Function** → Formats and sends trade data via webhook
3. **Webhook Server** → Receives HTTP requests, writes to file
4. **MT5 Expert Advisor** → Reads file, executes trades automatically

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Lovable Auto    │ -> │ Supabase Edge    │ -> │ Webhook Server  │ -> │ MT5 Expert      │
│ Trading System  │    │ Function         │    │ (localhost:8080)│    │ Advisor         │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │ Command File    │
                                               │ (AutoTrading    │
                                               │ Commands.txt)   │
                                               └─────────────────┘
```

The system uses file-based communication because MT5 on macOS has limitations with DLL imports and direct HTTP servers.
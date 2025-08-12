# Complete MT5 Integration Setup Guide for macOS

## Prerequisites

1. **MetaTrader 5** installed on macOS
2. **Node.js** (version 14 or higher)
3. **Active trading account** with your broker
4. **Lovable Auto Trading System** configured

## Step 1: Install Node.js Dependencies

```bash
cd mt5-integration
npm install
```

## Step 2: Start the Webhook Server

```bash
npm start
```

You should see:
```
🚀 MT5 Webhook Server running on http://localhost:8080
📁 MT5 Data Path: /Users/[username]/Library/Application Support/MetaQuotes/Terminal/Common/Files
📄 Command File: /Users/[username]/Library/Application Support/MetaQuotes/Terminal/Common/Files/AutoTradingCommands.txt

✅ Server is ready to receive trade commands from Lovable Auto Trading
```

## Step 3: Install Expert Advisor in MT5

### 3.1 Copy the Expert Advisor File

1. Open MT5
2. Go to **File** → **Open Data Folder**
3. Navigate to **MQL5** → **Experts**
4. Copy `AutoTradingReceiver.mq5` to this folder

### 3.2 Compile the Expert Advisor

1. In MT5, open **MetaEditor** (F4 or Tools → MetaQuotes Language Editor)
2. Open `AutoTradingReceiver.mq5`
3. Click **Compile** (F7) or press the compile button
4. Ensure there are no errors

### 3.3 Enable WebRequest for Localhost

1. In MT5, go to **Tools** → **Options**
2. Click **Expert Advisors** tab
3. Check **Allow WebRequest for listed URL**
4. Add `localhost` to the URL list
5. Click **OK**

### 3.4 Attach Expert Advisor to Chart

1. In MT5, open any chart (e.g., EURUSD)
2. Drag `AutoTradingReceiver` from Navigator → Expert Advisors to the chart
3. In the dialog that appears:
   - **Common tab**: Check "Allow live trading"
   - **Inputs tab**: Configure settings:
     - `WebhookURL`: `http://localhost:8080/webhook`
     - `DefaultLotSize`: `0.01` (or your preferred size)
     - `MagicNumber`: `12345` (unique identifier)
     - `EnableLogging`: `true`
4. Click **OK**

## Step 4: Configure Lovable Auto Trading

1. In your Lovable dashboard, go to **MT5 Integration** tab
2. Enter webhook URL: `http://localhost:8080/webhook`
3. Click **Save Configuration**
4. Click **Test Connection** to verify

## Step 5: Test the Integration

### 5.1 Test Connection

1. Click **Test Connection** in Lovable MT5 Integration tab
2. Check MT5 Expert tab for message: "Test connection received - MT5 EA is working!"
3. Check webhook server console for received request

### 5.2 Test with Real Trade

1. Ensure auto-trading is enabled in your Lovable system
2. Wait for a trade signal to be generated
3. Monitor:
   - Webhook server console for incoming requests
   - MT5 Expert tab for trade execution logs
   - MT5 Trade tab for actual positions

## Troubleshooting

### Common Issues

**Issue**: "WebRequest not allowed"
- **Solution**: Add `localhost` to allowed URLs in MT5 Options → Expert Advisors

**Issue**: EA not receiving commands
- **Solution**: Check file permissions for MT5 data folder

**Issue**: Webhook server not receiving requests
- **Solution**: Verify firewall settings allow localhost:8080

**Issue**: Trades not executing in MT5
- **Solution**: Check if live trading is enabled and account has sufficient balance

### Debugging Steps

1. **Check webhook server logs**:
   ```bash
   curl http://localhost:8080/health
   ```

2. **Verify MT5 data path**:
   - Check if the command file is being created
   - Location: `~/Library/Application Support/MetaQuotes/Terminal/Common/Files/AutoTradingCommands.txt`

3. **Check MT5 Expert logs**:
   - Open MT5 → View → Toolbox → Expert
   - Look for AutoTradingReceiver messages

4. **Test manual command**:
   ```bash
   curl -X POST http://localhost:8080/webhook \
     -H "Content-Type: application/json" \
     -d '{"command":"TEST_CONNECTION","trade_id":"test_123","symbol":"EURUSD"}'
   ```

## Security Considerations

1. **Firewall**: The webhook server only accepts localhost connections
2. **File permissions**: MT5 data folder should be accessible only to your user
3. **Network**: No external network access required for basic operation

## Advanced Configuration

### Custom MT5 Data Path

If your MT5 data folder is in a different location:

1. Find your MT5 data folder:
   - Open MT5 → File → Open Data Folder
   - Note the path

2. Update `webhook-server.js`:
   ```javascript
   const MT5_DATA_PATH = '/your/custom/path/Common/Files';
   ```

### Running as Service

To run the webhook server as a background service:

```bash
# Install PM2
npm install -g pm2

# Start as service
pm2 start webhook-server.js --name "mt5-webhook"

# Save PM2 configuration
pm2 save

# Setup auto-start
pm2 startup
```

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify all prerequisites are met
3. Test each component individually
4. Check MT5 and webhook server logs for error messages

The integration should now be fully functional, automatically executing trades from your Lovable Auto Trading System in MT5!
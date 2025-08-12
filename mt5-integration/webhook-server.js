#!/usr/bin/env node

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8080;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Path to MT5 data folder on macOS
const MT5_DATA_PATH = path.join(process.env.HOME, 'Library/Application Support/MetaQuotes/Terminal/Common/Files');
const COMMAND_FILE = path.join(MT5_DATA_PATH, 'AutoTradingCommands.txt');

console.log('MT5 Data Path:', MT5_DATA_PATH);
console.log('Command File:', COMMAND_FILE);

// Ensure directory exists
const ensureDirectoryExists = (filePath) => {
    const dirname = path.dirname(filePath);
    if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname, { recursive: true });
    }
};

// Webhook endpoint to receive trade commands
app.post('/webhook', (req, res) => {
    try {
        console.log('Received webhook:', JSON.stringify(req.body, null, 2));
        
        // Ensure directory exists
        ensureDirectoryExists(COMMAND_FILE);
        
        // Append command to file for MT5 EA to read
        const commandLine = JSON.stringify(req.body) + '\n';
        fs.appendFileSync(COMMAND_FILE, commandLine);
        
        console.log('Command written to file:', COMMAND_FILE);
        
        res.json({ 
            success: true, 
            message: 'Trade command received and queued for MT5',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'MT5 Webhook Server is running',
        mt5_data_path: MT5_DATA_PATH,
        command_file: COMMAND_FILE,
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    const stats = {
        server_status: 'running',
        mt5_data_accessible: fs.existsSync(MT5_DATA_PATH),
        command_file_exists: fs.existsSync(COMMAND_FILE),
        timestamp: new Date().toISOString()
    };
    
    res.json(stats);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 MT5 Webhook Server running on http://localhost:${PORT}`);
    console.log(`📁 MT5 Data Path: ${MT5_DATA_PATH}`);
    console.log(`📄 Command File: ${COMMAND_FILE}`);
    console.log(`\n✅ Server is ready to receive trade commands from Lovable Auto Trading`);
    console.log(`🔗 Test endpoint: http://localhost:${PORT}/test`);
    console.log(`❤️  Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down MT5 Webhook Server...');
    process.exit(0);
});
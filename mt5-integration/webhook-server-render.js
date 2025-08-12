const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Path to MT5 data folder (Render compatible)
const MT5_DATA_PATH = path.join(__dirname, 'mt5-data');
const COMMAND_FILE = path.join(MT5_DATA_PATH, 'AutoTradingCommands.txt');

console.log('🚀 Starting MT5 Webhook Server on Render...');
console.log('📍 Port:', PORT);
console.log('📁 MT5 Data Path:', MT5_DATA_PATH);
console.log('📄 Command File:', COMMAND_FILE);

// Ensure directory exists
const ensureDirectoryExists = (filePath) => {
    const dirname = path.dirname(filePath);
    if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname, { recursive: true });
        console.log('✅ Created directory:', dirname);
    }
};

// CORS headers for web requests
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// Handle CORS preflight
app.options('*', (req, res) => {
    res.set(corsHeaders);
    res.status(200).end();
});

// Add CORS headers to all responses
app.use((req, res, next) => {
    res.set(corsHeaders);
    next();
});

// Webhook endpoint to receive trade commands
app.post('/webhook', (req, res) => {
    try {
        console.log('📨 Received webhook:', JSON.stringify(req.body, null, 2));
        
        // Ensure directory exists
        ensureDirectoryExists(COMMAND_FILE);
        
        // Append command to file for MT5 EA to read
        const timestamp = new Date().toISOString();
        const commandLine = JSON.stringify({
            ...req.body,
            received_at: timestamp,
            server: 'render'
        }) + '\n';
        
        fs.appendFileSync(COMMAND_FILE, commandLine);
        
        console.log('✅ Command written to file:', COMMAND_FILE);
        
        res.json({ 
            success: true, 
            message: 'Trade command received and queued for MT5',
            timestamp: timestamp,
            server: 'Render',
            file_path: COMMAND_FILE
        });
    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Test endpoint
app.get('/test', (req, res) => {
    console.log('🔍 Test endpoint accessed');
    res.json({ 
        status: 'OK', 
        message: 'MT5 Webhook Server is running on Render',
        server_info: {
            platform: 'Render',
            port: PORT,
            node_version: process.version,
            uptime: process.uptime()
        },
        paths: {
            mt5_data_path: MT5_DATA_PATH,
            command_file: COMMAND_FILE
        },
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    console.log('❤️ Health check accessed');
    const stats = {
        server_status: 'running',
        platform: 'Render',
        mt5_data_accessible: fs.existsSync(MT5_DATA_PATH),
        command_file_exists: fs.existsSync(COMMAND_FILE),
        directory_writable: true,
        timestamp: new Date().toISOString()
    };
    
    try {
        // Test if we can write to the directory
        const testFile = path.join(MT5_DATA_PATH, 'test.txt');
        ensureDirectoryExists(testFile);
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
    } catch (error) {
        stats.directory_writable = false;
        stats.write_error = error.message;
    }
    
    res.json(stats);
});

// Root endpoint
app.get('/', (req, res) => {
    console.log('🏠 Root endpoint accessed');
    res.json({
        message: 'MT5 Webhook Server for Render',
        version: '1.0.0',
        platform: 'Render',
        status: 'running',
        endpoints: {
            root: '/ (GET) - This page',
            webhook: '/webhook (POST) - Receive MT5 commands',
            test: '/test (GET) - Server test',
            health: '/health (GET) - Health check'
        },
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('💥 Server error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 MT5 Webhook Server successfully started on Render!');
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌐 Platform: Render`);
    console.log(`📁 Data directory: ${MT5_DATA_PATH}`);
    console.log(`📄 Command file: ${COMMAND_FILE}`);
    console.log('✅ Ready to receive trade commands from Lovable Auto Trading');
});

module.exports = app;
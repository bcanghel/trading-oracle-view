//+------------------------------------------------------------------+
//|                                           AutoTradingReceiver.mq5 |
//|                                  Copyright 2024, Lovable Trading |
//|                                                                  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Lovable Trading"
#property link      ""
#property version   "1.00"
#property description "Expert Advisor to receive and execute trades from Lovable Auto Trading System"

//--- Input parameters
input string WebhookURL = "http://localhost:8080/webhook";  // Webhook endpoint URL
input double DefaultLotSize = 0.01;                         // Default lot size if not specified
input int MagicNumber = 12345;                              // Magic number for trade identification
input bool EnableLogging = true;                            // Enable detailed logging
input int CheckInterval = 1000;                             // Check interval in milliseconds

//--- Global variables
struct TradeCommand {
    string command;
    string trade_id;
    string symbol;
    string action;
    double volume;
    double price;
    double sl;
    double tp;
    string comment;
};

//--- Trade storage
string ActiveTradeIDs[];
ulong ActiveTickets[];

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
    Print("AutoTradingReceiver EA initialized");
    Print("Webhook URL: ", WebhookURL);
    Print("Magic Number: ", MagicNumber);
    
    // Enable WebRequest for the webhook URL
    string url_allowed[];
    string url = WebhookURL;
    StringReplace(url, "http://", "");
    StringReplace(url, "https://", "");
    int pos = StringFind(url, "/");
    if(pos > 0) url = StringSubstr(url, 0, pos);
    
    Print("Please add the following URL to WebRequest allowed URLs in Tools->Options->Expert Advisors:");
    Print(url);
    
    return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    Print("AutoTradingReceiver EA deinitialized. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
    // Check for new commands periodically (every 1000 ticks to avoid overload)
    static int tick_count = 0;
    tick_count++;
    
    if(tick_count >= 1000) {
        CheckForNewCommands();
        tick_count = 0;
    }
    
    // Monitor existing trades
    MonitorActiveTrades();
}

//+------------------------------------------------------------------+
//| Check for new commands from webhook                              |
//+------------------------------------------------------------------+
void CheckForNewCommands()
{
    // Note: In a real implementation, you would have a local server
    // that receives webhooks and stores them in a file or database
    // that this EA can read. For now, we'll simulate this.
    
    // This is where you would implement reading from a local file
    // or making HTTP requests to check for new commands
    CheckLocalCommandFile();
}

//+------------------------------------------------------------------+
//| Check local command file for new trades                         |
//+------------------------------------------------------------------+
void CheckLocalCommandFile()
{
    string filename = "AutoTradingCommands.txt";
    int file_handle = FileOpen(filename, FILE_READ|FILE_TXT);
    
    if(file_handle != INVALID_HANDLE) {
        while(!FileIsEnding(file_handle)) {
            string line = FileReadString(file_handle);
            if(StringLen(line) > 0) {
                ProcessCommandLine(line);
            }
        }
        FileClose(file_handle);
        
        // Clear the file after processing
        file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT);
        if(file_handle != INVALID_HANDLE) {
            FileClose(file_handle);
        }
    }
}

//+------------------------------------------------------------------+
//| Process a command line from the file                            |
//+------------------------------------------------------------------+
void ProcessCommandLine(string command_json)
{
    if(EnableLogging) Print("Processing command: ", command_json);
    
    TradeCommand cmd;
    if(ParseTradeCommand(command_json, cmd)) {
        ExecuteTradeCommand(cmd);
    }
}

//+------------------------------------------------------------------+
//| Parse JSON command into TradeCommand structure                  |
//+------------------------------------------------------------------+
bool ParseTradeCommand(string json, TradeCommand &cmd)
{
    // Simple JSON parsing - in production you'd use a proper JSON library
    cmd.command = ExtractJsonValue(json, "command");
    cmd.trade_id = ExtractJsonValue(json, "trade_id");
    cmd.symbol = ExtractJsonValue(json, "symbol");
    cmd.action = ExtractJsonValue(json, "action");
    cmd.volume = StringToDouble(ExtractJsonValue(json, "volume"));
    cmd.price = StringToDouble(ExtractJsonValue(json, "price"));
    cmd.sl = StringToDouble(ExtractJsonValue(json, "sl"));
    cmd.tp = StringToDouble(ExtractJsonValue(json, "tp"));
    cmd.comment = ExtractJsonValue(json, "comment");
    
    if(cmd.volume <= 0) cmd.volume = DefaultLotSize;
    
    return StringLen(cmd.command) > 0 && StringLen(cmd.trade_id) > 0;
}

//+------------------------------------------------------------------+
//| Simple JSON value extraction                                    |
//+------------------------------------------------------------------+
string ExtractJsonValue(string json, string key)
{
    string search_key = "\"" + key + "\":";
    int start_pos = StringFind(json, search_key);
    if(start_pos < 0) return "";
    
    start_pos += StringLen(search_key);
    
    // Skip whitespace and quotes
    while(start_pos < StringLen(json) && (StringGetCharacter(json, start_pos) == ' ' || StringGetCharacter(json, start_pos) == '"'))
        start_pos++;
    
    int end_pos = start_pos;
    bool in_string = false;
    
    // Find end of value
    while(end_pos < StringLen(json)) {
        ushort char_code = StringGetCharacter(json, end_pos);
        if(char_code == '"') in_string = !in_string;
        else if(!in_string && (char_code == ',' || char_code == '}')) break;
        end_pos++;
    }
    
    string value = StringSubstr(json, start_pos, end_pos - start_pos);
    StringReplace(value, "\"", "");
    return value;
}

//+------------------------------------------------------------------+
//| Execute trade command                                            |
//+------------------------------------------------------------------+
void ExecuteTradeCommand(TradeCommand &cmd)
{
    if(EnableLogging) {
        Print("Executing command: ", cmd.command, " for ", cmd.trade_id);
    }
    
    if(cmd.command == "OPEN_TRADE") {
        OpenTrade(cmd);
    }
    else if(cmd.command == "CLOSE_TRADE") {
        CloseTrade(cmd);
    }
    else if(cmd.command == "MODIFY_TRADE") {
        ModifyTrade(cmd);
    }
    else if(cmd.command == "TEST_CONNECTION") {
        Print("Test connection received - MT5 EA is working!");
    }
    else {
        Print("Unknown command: ", cmd.command);
    }
}

//+------------------------------------------------------------------+
//| Open a new trade                                                |
//+------------------------------------------------------------------+
void OpenTrade(TradeCommand &cmd)
{
    // Check if trade already exists
    if(FindTradeByID(cmd.trade_id) >= 0) {
        Print("Trade ", cmd.trade_id, " already exists, skipping");
        return;
    }
    
    MqlTradeRequest request;
    MqlTradeResult result;
    ZeroMemory(request);
    ZeroMemory(result);
    
    // Prepare trade request
    request.action = TRADE_ACTION_DEAL;
    request.symbol = cmd.symbol;
    request.volume = cmd.volume;
    request.type = (cmd.action == "BUY") ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
    request.price = (cmd.action == "BUY") ? SymbolInfoDouble(cmd.symbol, SYMBOL_ASK) : SymbolInfoDouble(cmd.symbol, SYMBOL_BID);
    request.sl = cmd.sl;
    request.tp = cmd.tp;
    request.deviation = 10;
    request.magic = MagicNumber;
    request.comment = cmd.comment + " [" + cmd.trade_id + "]";
    
    // Execute trade
    if(OrderSend(request, result)) {
        if(result.retcode == TRADE_RETCODE_DONE) {
            // Store trade mapping
            AddTradeMapping(cmd.trade_id, result.order);
            Print("Trade opened successfully: ", cmd.trade_id, " -> Ticket: ", result.order);
        }
        else {
            Print("Trade failed: ", cmd.trade_id, " - Error: ", result.retcode, " - ", result.comment);
        }
    }
    else {
        Print("OrderSend failed for trade: ", cmd.trade_id, " - Error: ", GetLastError());
    }
}

//+------------------------------------------------------------------+
//| Close an existing trade                                         |
//+------------------------------------------------------------------+
void CloseTrade(TradeCommand &cmd)
{
    int index = FindTradeByID(cmd.trade_id);
    if(index < 0) {
        Print("Trade not found for closing: ", cmd.trade_id);
        return;
    }
    
    ulong ticket = ActiveTickets[index];
    
    if(PositionSelectByTicket(ticket)) {
        MqlTradeRequest request;
        MqlTradeResult result;
        ZeroMemory(request);
        ZeroMemory(result);
        
        request.action = TRADE_ACTION_DEAL;
        request.position = ticket;
        request.symbol = PositionGetString(POSITION_SYMBOL);
        request.volume = PositionGetDouble(POSITION_VOLUME);
        request.type = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
        request.price = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? 
                       SymbolInfoDouble(request.symbol, SYMBOL_BID) : 
                       SymbolInfoDouble(request.symbol, SYMBOL_ASK);
        request.magic = MagicNumber;
        request.comment = "Close " + cmd.trade_id;
        
        if(OrderSend(request, result)) {
            if(result.retcode == TRADE_RETCODE_DONE) {
                RemoveTradeMapping(index);
                Print("Trade closed successfully: ", cmd.trade_id);
            }
            else {
                Print("Failed to close trade: ", cmd.trade_id, " - Error: ", result.retcode);
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Modify an existing trade                                        |
//+------------------------------------------------------------------+
void ModifyTrade(TradeCommand &cmd)
{
    int index = FindTradeByID(cmd.trade_id);
    if(index < 0) {
        Print("Trade not found for modification: ", cmd.trade_id);
        return;
    }
    
    ulong ticket = ActiveTickets[index];
    
    if(PositionSelectByTicket(ticket)) {
        MqlTradeRequest request;
        MqlTradeResult result;
        ZeroMemory(request);
        ZeroMemory(result);
        
        request.action = TRADE_ACTION_SLTP;
        request.position = ticket;
        request.sl = cmd.sl;
        request.tp = cmd.tp;
        request.magic = MagicNumber;
        
        if(OrderSend(request, result)) {
            if(result.retcode == TRADE_RETCODE_DONE) {
                Print("Trade modified successfully: ", cmd.trade_id);
            }
            else {
                Print("Failed to modify trade: ", cmd.trade_id, " - Error: ", result.retcode);
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Add trade mapping                                               |
//+------------------------------------------------------------------+
void AddTradeMapping(string trade_id, ulong ticket)
{
    int size = ArraySize(ActiveTradeIDs);
    ArrayResize(ActiveTradeIDs, size + 1);
    ArrayResize(ActiveTickets, size + 1);
    
    ActiveTradeIDs[size] = trade_id;
    ActiveTickets[size] = ticket;
}

//+------------------------------------------------------------------+
//| Remove trade mapping                                            |
//+------------------------------------------------------------------+
void RemoveTradeMapping(int index)
{
    int size = ArraySize(ActiveTradeIDs);
    if(index >= 0 && index < size) {
        for(int i = index; i < size - 1; i++) {
            ActiveTradeIDs[i] = ActiveTradeIDs[i + 1];
            ActiveTickets[i] = ActiveTickets[i + 1];
        }
        ArrayResize(ActiveTradeIDs, size - 1);
        ArrayResize(ActiveTickets, size - 1);
    }
}

//+------------------------------------------------------------------+
//| Find trade by ID                                                |
//+------------------------------------------------------------------+
int FindTradeByID(string trade_id)
{
    for(int i = 0; i < ArraySize(ActiveTradeIDs); i++) {
        if(ActiveTradeIDs[i] == trade_id) {
            return i;
        }
    }
    return -1;
}

//+------------------------------------------------------------------+
//| Monitor active trades                                           |
//+------------------------------------------------------------------+
void MonitorActiveTrades()
{
    // Check if any of our tracked trades have been closed externally
    for(int i = ArraySize(ActiveTickets) - 1; i >= 0; i--) {
        if(!PositionSelectByTicket(ActiveTickets[i])) {
            Print("Trade ", ActiveTradeIDs[i], " was closed externally");
            RemoveTradeMapping(i);
        }
    }
}
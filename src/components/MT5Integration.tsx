import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { useToast } from "./ui/use-toast";
import { Settings, Zap, AlertCircle, CheckCircle } from "lucide-react";

export const MT5Integration = () => {
  const [webhookUrl, setWebhookUrl] = useState(localStorage.getItem('mt5_webhook_url') || '');
  const [isConnected, setIsConnected] = useState(!!localStorage.getItem('mt5_webhook_url'));
  const [isTesting, setIsTesting] = useState(false);
  const { toast } = useToast();

  const handleSaveWebhook = () => {
    if (!webhookUrl) {
      toast({
        title: "Error",
        description: "Please enter a valid MT5 webhook URL",
        variant: "destructive",
      });
      return;
    }

    localStorage.setItem('mt5_webhook_url', webhookUrl);
    setIsConnected(true);
    toast({
      title: "Success",
      description: "MT5 webhook URL saved successfully",
    });
  };

  const handleTestConnection = async () => {
    if (!webhookUrl) {
      toast({
        title: "Error",
        description: "Please enter a webhook URL first",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    try {
      const testData = {
        command: 'TEST_CONNECTION',
        trade_id: 'test_' + Date.now(),
        symbol: 'EURUSD',
        comment: 'Connection test from Lovable Auto Trading'
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData),
      });

      if (response.ok) {
        toast({
          title: "Connection Successful",
          description: "MT5 Expert Advisor is responding correctly",
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('MT5 connection test failed:', error);
      toast({
        title: "Connection Failed",
        description: `Unable to connect to MT5: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem('mt5_webhook_url');
    setWebhookUrl('');
    setIsConnected(false);
    toast({
      title: "Disconnected",
      description: "MT5 integration has been disabled",
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>MetaTrader 5 Integration</CardTitle>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"}>
            {isConnected ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 mr-1" />
                Not Connected
              </>
            )}
          </Badge>
        </div>
        <CardDescription>
          Configure your MT5 Expert Advisor to receive real-time trade signals from the auto-trading system.
          Every trade opened, modified, or closed will be automatically mirrored in your MT5 terminal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="webhook-url">MT5 Expert Advisor Webhook URL</Label>
          <Input
            id="webhook-url"
            type="url"
            placeholder="http://localhost:8080/webhook or your EA endpoint"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            This is the endpoint where your MT5 Expert Advisor will receive trade commands.
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSaveWebhook} disabled={!webhookUrl}>
            Save Configuration
          </Button>
          <Button 
            variant="outline" 
            onClick={handleTestConnection} 
            disabled={!webhookUrl || isTesting}
          >
            <Zap className="h-4 w-4 mr-2" />
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>
          {isConnected && (
            <Button variant="destructive" onClick={handleDisconnect}>
              Disconnect
            </Button>
          )}
        </div>

        <div className="bg-muted p-4 rounded-lg space-y-2">
          <h4 className="font-medium">How it works:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Database triggers automatically detect trade changes</li>
            <li>• Trade data is sent to your MT5 Expert Advisor in real-time</li>
            <li>• Includes unique trade IDs for proper mapping</li>
            <li>• Supports OPEN, CLOSE, and MODIFY operations</li>
            <li>• All execution details included (symbol, lot size, SL, TP)</li>
          </ul>
        </div>

        {isConnected && (
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <CheckCircle className="h-4 w-4 inline mr-2" />
              MT5 integration is active. All auto-trades will be synchronized with your MT5 terminal.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
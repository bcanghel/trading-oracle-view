import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function ResetAutoTrades() {
  const { toast } = useToast();
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const { error } = await supabase
        .from('auto_trades')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "All auto trades have been reset. You can start fresh!",
        variant: "default",
      });
    } catch (error) {
      console.error('Error resetting auto trades:', error);
      toast({
        title: "Error",
        description: "Failed to reset auto trades. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Trash2 className="h-4 w-4" />
          Reset All Trades
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset All Auto Trades</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete all your auto trading history and active trades. 
            This action cannot be undone. Are you sure you want to start from scratch?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleReset}
            disabled={isResetting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isResetting ? "Resetting..." : "Reset All Trades"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
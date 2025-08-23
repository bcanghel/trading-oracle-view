import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { format, isAfter, subDays } from "date-fns";

interface USDFundamental {
  id: string;
  event_type: string;
  event_date: string;
  actual_value: number;
  forecast_value: number | null;
  previous_value: number | null;
  created_at: string;
}

const USD_EVENTS = [
  "CPI",
  "Core CPI", 
  "PCE",
  "NFP",
  "Unemployment",
  "Jobless Claims",
  "GDP",
  "PMI Manufacturing",
  "PMI Services", 
  "Retail Sales",
  "Rate Decision"
];

export default function USDFundamentals() {
  const [fundamentals, setFundamentals] = useState<USDFundamental[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    event_type: "",
    event_date: "",
    actual_value: "",
    forecast_value: "",
    previous_value: ""
  });

  useEffect(() => {
    fetchFundamentals();
  }, []);

  const fetchFundamentals = async () => {
    try {
      const { data, error } = await supabase
        .from('usd_fundamentals')
        .select('*')
        .order('event_date', { ascending: false });

      if (error) throw error;
      setFundamentals(data || []);
    } catch (error) {
      console.error('Error fetching USD fundamentals:', error);
      toast({
        title: "Error",
        description: "Failed to fetch USD fundamentals",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.event_type || !formData.event_date || !formData.actual_value) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase.from('usd_fundamentals').insert({
        user_id: userData.user.id,
        event_type: formData.event_type,
        event_date: formData.event_date,
        actual_value: parseFloat(formData.actual_value),
        forecast_value: formData.forecast_value ? parseFloat(formData.forecast_value) : null,
        previous_value: formData.previous_value ? parseFloat(formData.previous_value) : null
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "USD fundamental data added successfully"
      });

      setFormData({
        event_type: "",
        event_date: "",
        actual_value: "",
        forecast_value: "",
        previous_value: ""
      });

      fetchFundamentals();
    } catch (error) {
      console.error('Error adding fundamental:', error);
      toast({
        title: "Error",
        description: "Failed to add USD fundamental data",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('usd_fundamentals')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "USD fundamental data deleted successfully"
      });

      fetchFundamentals();
    } catch (error) {
      console.error('Error deleting fundamental:', error);
      toast({
        title: "Error",
        description: "Failed to delete USD fundamental data",
        variant: "destructive"
      });
    }
  };

  const isExpired = (eventDate: string) => {
    const cutoffDate = subDays(new Date(), 14);
    return !isAfter(new Date(eventDate), cutoffDate);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add USD Economic Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event_type">Event Type *</Label>
                <Select
                  value={formData.event_type}
                  onValueChange={(value) => setFormData({ ...formData, event_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent>
                    {USD_EVENTS.map((event) => (
                      <SelectItem key={event} value={event}>
                        {event}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="event_date">Event Date *</Label>
                <Input
                  id="event_date"
                  type="datetime-local"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="actual_value">Actual Value *</Label>
                <Input
                  id="actual_value"
                  type="number"
                  step="0.1"
                  value={formData.actual_value}
                  onChange={(e) => setFormData({ ...formData, actual_value: e.target.value })}
                  placeholder="3.2"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="forecast_value">Forecast Value</Label>
                <Input
                  id="forecast_value"
                  type="number"
                  step="0.1"
                  value={formData.forecast_value}
                  onChange={(e) => setFormData({ ...formData, forecast_value: e.target.value })}
                  placeholder="3.0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="previous_value">Previous Value</Label>
                <Input
                  id="previous_value"
                  type="number"
                  step="0.1"
                  value={formData.previous_value}
                  onChange={(e) => setFormData({ ...formData, previous_value: e.target.value })}
                  placeholder="3.1"
                />
              </div>
            </div>

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add USD Data
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent USD Economic Data</CardTitle>
        </CardHeader>
        <CardContent>
          {fundamentals.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No USD fundamental data found. Add some economic indicators above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actual</TableHead>
                  <TableHead>Forecast</TableHead>
                  <TableHead>Previous</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fundamentals.map((fundamental) => (
                  <TableRow key={fundamental.id}>
                    <TableCell className="font-medium">
                      {fundamental.event_type}
                    </TableCell>
                    <TableCell>
                      {format(new Date(fundamental.event_date), 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>{fundamental.actual_value}</TableCell>
                    <TableCell>{fundamental.forecast_value ?? '—'}</TableCell>
                    <TableCell>{fundamental.previous_value ?? '—'}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={isExpired(fundamental.event_date) ? "secondary" : "default"}
                      >
                        {isExpired(fundamental.event_date) ? "Expired" : "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(fundamental.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
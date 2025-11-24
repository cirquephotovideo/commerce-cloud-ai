import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function MaterializedViewRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const startTime = Date.now();

    try {
      toast.info("Initializing materialized view refresh...", {
        description: "This may take 2-5 minutes for large datasets"
      });

      // Call the public init function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/init-materialized-view`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      const data = await response.json();
      const elapsed = Date.now() - startTime;

      if (response.ok && data.success) {
        setLastRefresh(new Date());
        setDuration(data.duration_ms);
        toast.success(`✅ View refreshed successfully`, {
          description: `Completed in ${(data.duration_ms / 1000).toFixed(1)}s`
        });
      } else if (response.status === 202) {
        // Partial success (timeout)
        toast.warning("⚠️ Refresh timeout", {
          description: "The view is very large. Try again or reduce data volume."
        });
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('[REFRESH] Error:', error);
      toast.error("Failed to refresh view", {
        description: error.message
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Unified Products View
        </CardTitle>
        <CardDescription>
          Materialized view aggregating products from all sources
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            The unified products view needs to be refreshed periodically to reflect latest data.
            For {" "}<strong>132k+ products</strong>, refresh may take 2-5 minutes.
          </AlertDescription>
        </Alert>

        {lastRefresh && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>
              Last refreshed: {lastRefresh.toLocaleString()}
              {duration && ` (${(duration / 1000).toFixed(1)}s)`}
            </span>
          </div>
        )}

        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="w-full"
        >
          {isRefreshing ? (
            <>
              <Clock className="mr-2 h-4 w-4 animate-spin" />
              Refreshing... This may take several minutes
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Unified Products View
            </>
          )}
        </Button>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Aggregates data from product_analyses, supplier_products, and links</p>
          <p>• Calculates best prices, stock totals, and potential savings</p>
          <p>• Required for /unified-products page to function</p>
        </div>
      </CardContent>
    </Card>
  );
}

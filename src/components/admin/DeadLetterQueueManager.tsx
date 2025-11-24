import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface DLQEntry {
  id: string;
  job_id: string;
  chunk_data: {
    supplier_id: string;
    platform: string;
    offset: number;
    limit: number;
    correlation_id?: string;
  };
  error_details: {
    message: string;
    error_code?: string;
    retry_count: number;
  };
  retry_count: number;
  created_at: string;
  resolved_at: string | null;
}

export function DeadLetterQueueManager() {
  const queryClient = useQueryClient();

  const { data: dlqEntries, isLoading } = useQuery({
    queryKey: ['dlq-entries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_dead_letters')
        .select('*')
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Parse JSONB fields properly
      return (data || []).map(entry => ({
        ...entry,
        chunk_data: entry.chunk_data as DLQEntry['chunk_data'],
        error_details: entry.error_details as DLQEntry['error_details']
      }));
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const retryChunkMutation = useMutation({
    mutationFn: async (entry: DLQEntry) => {
      // Retry the chunk by invoking process-import-chunk again
      const { error } = await supabase.functions.invoke('process-import-chunk', {
        body: {
          import_job_id: entry.job_id,
          supplier_id: entry.chunk_data.supplier_id,
          platform: entry.chunk_data.platform,
          offset: entry.chunk_data.offset,
          limit: entry.chunk_data.limit,
          options: {}
        }
      });

      if (error) throw error;

      // Mark as resolved
      const { error: updateError } = await supabase
        .from('import_dead_letters')
        .update({ 
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', entry.id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Chunk retry initiated");
      queryClient.invalidateQueries({ queryKey: ['dlq-entries'] });
    },
    onError: (error: any) => {
      toast.error("Retry failed: " + error.message);
    }
  });

  const markResolvedMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('import_dead_letters')
        .update({ 
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', entryId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entry marked as resolved");
      queryClient.invalidateQueries({ queryKey: ['dlq-entries'] });
    },
    onError: (error: any) => {
      toast.error("Failed to resolve: " + error.message);
    }
  });

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading DLQ entries...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dead Letter Queue</h2>
        <p className="text-muted-foreground">
          Failed import chunks requiring manual intervention
        </p>
      </div>

      {!dlqEntries || dlqEntries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Failed Chunks</h3>
            <p className="text-muted-foreground">
              All import operations are completing successfully
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="destructive" className="text-sm">
              {dlqEntries.length} unresolved entries
            </Badge>
          </div>

          {dlqEntries.map((entry) => (
            <Card key={entry.id} className="border-destructive">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      Chunk Failed: Offset {entry.chunk_data.offset}
                    </CardTitle>
                    <CardDescription>
                      Job ID: {entry.job_id.slice(0, 8)}... • 
                      Platform: {entry.chunk_data.platform} • 
                      {format(new Date(entry.created_at), "PPp")}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    {entry.retry_count} retries
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-4 rounded-md">
                  <p className="font-mono text-sm text-destructive">
                    {entry.error_details.message}
                  </p>
                  {entry.error_details.error_code && (
                    <p className="font-mono text-xs text-muted-foreground mt-2">
                      Code: {entry.error_details.error_code}
                    </p>
                  )}
                </div>

                <div className="text-sm space-y-1">
                  <p><span className="font-medium">Supplier ID:</span> {entry.chunk_data.supplier_id.slice(0, 8)}...</p>
                  <p><span className="font-medium">Chunk Range:</span> {entry.chunk_data.offset} - {entry.chunk_data.offset + entry.chunk_data.limit}</p>
                  {entry.chunk_data.correlation_id && (
                    <p><span className="font-medium">Correlation ID:</span> {entry.chunk_data.correlation_id}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => retryChunkMutation.mutate(entry)}
                    disabled={retryChunkMutation.isPending}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Chunk
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markResolvedMutation.mutate(entry.id)}
                    disabled={markResolvedMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Mark Resolved
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

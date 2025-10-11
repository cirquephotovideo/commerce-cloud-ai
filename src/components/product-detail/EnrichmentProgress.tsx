import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { useEnrichmentQueue } from "@/hooks/useEnrichmentQueue";
import { useQueryClient } from "@tanstack/react-query";

interface EnrichmentProgressProps {
  analysisId: string;
}

export const EnrichmentProgress = ({ analysisId }: EnrichmentProgressProps) => {
  const queryClient = useQueryClient();
  const { data: queue } = useEnrichmentQueue(analysisId);

  if (!queue) return null;

  const totalActive = (queue.pending?.length || 0) + (queue.processing?.length || 0);
  
  if (totalActive === 0 && queue.completed.length === 0 && queue.failed.length === 0) return null;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['enrichment-queue', analysisId] });
    queryClient.invalidateQueries({ queryKey: ['product-analysis', analysisId] });
  };

  return (
    <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950">
      <CardContent className="py-4">
        <div className="space-y-3">
          {/* Active enrichments */}
          {totalActive > 0 && (
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
              <div className="flex-1">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  {totalActive} enrichissement(s) en cours...
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {[...queue.pending, ...queue.processing]
                    .map(q => q.enrichment_type)
                    .flat()
                    .join(', ')}
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            {queue.pending.length > 0 && (
              <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-950">
                ⏳ {queue.pending.length} en attente
              </Badge>
            )}
            {queue.processing.length > 0 && (
              <Badge variant="outline" className="bg-blue-100 dark:bg-blue-950">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                {queue.processing.length} en traitement
              </Badge>
            )}
            {queue.completed.length > 0 && (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                {queue.completed.length} terminés
              </Badge>
            )}
            {queue.failed.length > 0 && (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                {queue.failed.length} échoués
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

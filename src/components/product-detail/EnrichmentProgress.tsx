import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface EnrichmentProgressProps {
  analysisId: string;
}

export const EnrichmentProgress = ({ analysisId }: EnrichmentProgressProps) => {
  const { data: queue } = useQuery({
    queryKey: ['enrichment-queue', analysisId],
    queryFn: async () => {
      const { data } = await supabase
        .from('enrichment_queue')
        .select('*')
        .eq('analysis_id', analysisId)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false });
      
      return data || [];
    },
    refetchInterval: 5000 // Polling toutes les 5 secondes
  });

  if (!queue || queue.length === 0) return null;

  return (
    <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950">
      <CardContent className="py-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
          <div>
            <p className="font-medium text-blue-900 dark:text-blue-100">
              {queue.length} enrichissement(s) en cours...
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {queue.map(q => q.enrichment_type).flat().join(', ')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

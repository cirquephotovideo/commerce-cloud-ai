import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useEnrichmentQueue = (analysisId: string) => {
  return useQuery({
    queryKey: ['enrichment-queue', analysisId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enrichment_queue')
        .select('*')
        .eq('analysis_id', analysisId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching enrichment queue:', error);
        return { pending: [], processing: [], completed: [], failed: [] };
      }

      return {
        pending: data?.filter(e => e.status === 'pending') || [],
        processing: data?.filter(e => e.status === 'processing') || [],
        completed: data?.filter(e => e.status === 'completed') || [],
        failed: data?.filter(e => e.status === 'failed') || [],
        all: data || []
      };
    },
    refetchInterval: 3000, // Poll every 3 seconds
    enabled: !!analysisId
  });
};

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useEnrichmentQueue = (analysisId: string) => {
  const queryClient = useQueryClient();

  // Realtime updates: invalidate query on any change for this analysis
  useEffect(() => {
    if (!analysisId) return;

    const channel = supabase
      .channel(`enrichment-queue-${analysisId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'enrichment_queue',
          filter: `analysis_id=eq.${analysisId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['enrichment-queue', analysisId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [analysisId, queryClient]);

  // Polling every 10 seconds to trigger processing if pending tasks exist
  useEffect(() => {
    if (!analysisId) return;

    const interval = setInterval(async () => {
      try {
        const { data: pendingTasks } = await supabase
          .from('enrichment_queue')
          .select('id')
          .eq('analysis_id', analysisId)
          .eq('status', 'pending')
          .limit(1);

        if (pendingTasks && pendingTasks.length > 0) {
          console.log('[useEnrichmentQueue] Pending tasks detected, triggering processing...');
          await supabase.functions.invoke('process-enrichment-queue', {
            body: { maxItems: 10, parallel: 3 }
          });
        }
      } catch (error) {
        console.error('[useEnrichmentQueue] Error checking pending tasks:', error);
      }
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [analysisId]);

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
        return { pending: [], processing: [], completed: [], failed: [] } as any;
      }

      return {
        pending: data?.filter(e => e.status === 'pending') || [],
        processing: data?.filter(e => e.status === 'processing') || [],
        completed: data?.filter(e => e.status === 'completed') || [],
        failed: data?.filter(e => e.status === 'failed') || [],
        all: data || []
      } as any;
    },
    // Polling adaptatif : rapide si tâches actives, sinon ralenti
    refetchInterval: (query) => {
      // Vérifier s'il y a des tâches en attente ou en cours
      if (!query.state.data) return 10000;
      
      const hasPendingOrProcessing = 
        (query.state.data.pending?.length || 0) > 0 || 
        (query.state.data.processing?.length || 0) > 0;
      
      // Si des tâches sont en cours : 2 secondes
      // Sinon : 10 secondes (économise les requêtes)
      return hasPendingOrProcessing ? 2000 : 10000;
    },
    enabled: !!analysisId
  });
};

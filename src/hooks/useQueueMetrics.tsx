import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface QueueMetrics {
  pending: number;
  processing: number;
  completed24h: number;
  failed24h: number;
  stuck: number;
  timestamp: string;
}

export const useQueueMetrics = () => {
  return useQuery<QueueMetrics>({
    queryKey: ['queue-metrics-live'],
    queryFn: async () => {
      const [pending, processing, completed24h, failed24h, stuck] = await Promise.all([
        supabase.from('enrichment_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('enrichment_queue').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
        supabase.from('enrichment_queue').select('*', { count: 'exact', head: true })
          .eq('status', 'completed')
          .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString()),
        supabase.from('enrichment_queue').select('*', { count: 'exact', head: true })
          .eq('status', 'failed')
          .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString()),
        supabase.from('supplier_products').select('*', { count: 'exact', head: true })
          .eq('enrichment_status', 'enriching')
          .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()),
      ]);
      
      return {
        pending: pending.count || 0,
        processing: processing.count || 0,
        completed24h: completed24h.count || 0,
        failed24h: failed24h.count || 0,
        stuck: stuck.count || 0,
        timestamp: new Date().toISOString(),
      };
    },
    refetchInterval: 10000, // 10s for live updates
  });
};
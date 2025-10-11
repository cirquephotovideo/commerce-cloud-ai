import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EnrichmentStatus {
  ai_analysis: boolean;
  amazon: boolean;
  video: 'pending' | 'processing' | 'completed' | 'failed' | null;
  images: number;
  isEnriching: boolean;
}

export const useProductEnrichmentStatus = (analysisId: string) => {
  const [status, setStatus] = useState<EnrichmentStatus>({
    ai_analysis: false,
    amazon: false,
    video: null,
    images: 0,
    isEnriching: false,
  });

  const checkStatuses = async () => {
    try {
      const [amazonData, videoData, enrichmentQueue] = await Promise.all([
        supabase
          .from('amazon_product_data')
          .select('id')
          .eq('analysis_id', analysisId)
          .maybeSingle(),
        supabase
          .from('product_videos')
          .select('status')
          .eq('analysis_id', analysisId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('enrichment_queue')
          .select('status')
          .eq('analysis_id', analysisId)
          .in('status', ['pending', 'processing']),
      ]);

      setStatus({
        ai_analysis: true, // Assume analysis exists if we have the ID
        amazon: Boolean(amazonData.data),
        video: (videoData.data?.status as any) || null,
        images: 0,
        isEnriching: (enrichmentQueue.data?.length || 0) > 0,
      });
    } catch (error) {
      console.error('Error checking enrichment status:', error);
    }
  };

  useEffect(() => {
    checkStatuses();

    // Polling toutes les 10 secondes si enrichissement en cours
    const interval = setInterval(() => {
      checkStatuses();
    }, 10000);

    return () => clearInterval(interval);
  }, [analysisId]);

  return { status, refetch: checkStatuses };
};

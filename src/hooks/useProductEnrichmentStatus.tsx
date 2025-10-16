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
      const [productAnalysis, amazonData, videoData, enrichmentQueue] = await Promise.all([
        // ✅ Vérifier les nouvelles colonnes d'enrichissement
        supabase
          .from('product_analyses')
          .select('specifications, long_description, cost_analysis, rsgp_compliance, enrichment_status')
          .eq('id', analysisId)
          .maybeSingle(),
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

      const enrichmentStatus = (productAnalysis.data?.enrichment_status || {}) as Record<string, any>;
      
      setStatus({
        ai_analysis: Boolean(productAnalysis.data),
        amazon: Boolean(amazonData.data),
        video: (videoData.data?.status as any) || null,
        images: 0, // TODO: Implémenter la vérification des images
        isEnriching: (enrichmentQueue.data?.length || 0) > 0 || 
                     enrichmentStatus.specifications === 'processing' ||
                     enrichmentStatus.technical_description === 'processing' ||
                     enrichmentStatus.cost_analysis === 'processing' ||
                     enrichmentStatus.rsgp === 'processing',
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

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
      if (!analysisId) return;

      const [productAnalysis, amazonData, videoData, enrichmentQueue] = await Promise.all([
        // ✅ Récupérer aussi les images pour compter correctement
        supabase
          .from('product_analyses')
          .select('specifications, long_description, cost_analysis, rsgp_compliance, enrichment_status, image_urls')
          .eq('id', analysisId)
          .maybeSingle(),
        supabase
          .from('amazon_product_data')
          .select('images')
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

      const analysisImages = Array.isArray(productAnalysis.data?.image_urls) ? productAnalysis.data?.image_urls : [];
      const amazonImages = Array.isArray(amazonData.data?.images) ? (amazonData.data?.images as any[]) : [];
      const imagesCount = (analysisImages?.length || 0) + (amazonImages?.length || 0);
      
      setStatus({
        ai_analysis: Boolean(productAnalysis.data),
        amazon: Boolean(amazonImages && amazonImages.length > 0 || amazonData.data),
        video: (videoData.data?.status as any) || null,
        images: imagesCount,
        // 🔁 Ne considère "en cours" que s'il existe des tâches actives dans la file
        isEnriching: (enrichmentQueue.data?.length || 0) > 0,
      });
    } catch (error) {
      console.error('Error checking enrichment status:', error);
    }
  };

  useEffect(() => {
    if (!analysisId) return;
    checkStatuses();

    // Polling toutes les 10 secondes si enrichissement en cours
    const interval = setInterval(() => {
      checkStatuses();
    }, 10000);

    return () => clearInterval(interval);
  }, [analysisId]);

  return { status, refetch: checkStatuses };
};

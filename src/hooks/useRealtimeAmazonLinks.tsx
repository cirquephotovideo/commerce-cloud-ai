import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function useRealtimeAmazonLinks() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('amazon-links-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'product_amazon_links'
        },
        async (payload) => {
          const link = payload.new as any;
          
          try {
            // Récupérer les détails du produit et de l'enrichissement Amazon
            const [analysisResult, enrichmentResult] = await Promise.all([
              supabase
                .from('product_analyses')
                .select('ean, analysis_result')
                .eq('id', link.analysis_id)
                .maybeSingle(),
              supabase
                .from('amazon_product_data')
                .select('asin, title, buy_box_price')
                .eq('id', link.enrichment_id)
                .maybeSingle()
            ]);

            const productName = (analysisResult.data?.analysis_result as any)?.name || 'Produit';
            const asin = enrichmentResult.data?.asin || 'N/A';
            const buyboxPrice = enrichmentResult.data?.buy_box_price;
            const confidenceScore = link.confidence_score ? Math.round(link.confidence_score * 100) : 100;
            const linkType = link.link_type === 'automatic' ? '🤖 Auto' : '👤 Manuel';

            // Toast avec les détails du lien Amazon
            if (confidenceScore === 100) {
              toast.success(`🛒 Lien Amazon créé : ${productName}`, {
                description: `${linkType} • ASIN: ${asin}${buyboxPrice ? ` • ${buyboxPrice}€` : ''} • ✅ ${confidenceScore}%`,
                duration: 3000,
              });
            } else if (confidenceScore >= 85) {
              toast.info(`🛒 Lien Amazon créé : ${productName}`, {
                description: `${linkType} • ASIN: ${asin}${buyboxPrice ? ` • ${buyboxPrice}€` : ''} • 🟡 ${confidenceScore}%`,
                duration: 3000,
              });
            } else {
              toast.warning(`🛒 Lien Amazon créé : ${productName}`, {
                description: `${linkType} • ASIN: ${asin}${buyboxPrice ? ` • ${buyboxPrice}€` : ''} • ⚠️ ${confidenceScore}%`,
                duration: 3000,
              });
            }

            // Invalider les caches
            queryClient.invalidateQueries({ queryKey: ['amazon-product-links'] });
            queryClient.invalidateQueries({ queryKey: ['product-links'] });
            queryClient.invalidateQueries({ queryKey: ['amazon-links-analytics'] });
          } catch (error) {
            console.error('[useRealtimeAmazonLinks] Error fetching link details:', error);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

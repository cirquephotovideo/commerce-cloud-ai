import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function useRealtimeProductLinks() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('product-links-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'product_links'
        },
        async (payload) => {
          const link = payload.new as any;
          
          try {
            // Récupérer les détails du produit pour le toast
            const [analysisResult, supplierResult] = await Promise.all([
              supabase
                .from('product_analyses')
                .select('ean, analysis_result')
                .eq('id', link.analysis_id)
                .maybeSingle(),
              supabase
                .from('supplier_products')
                .select('product_name')
                .eq('id', link.supplier_product_id)
                .maybeSingle()
            ]);

            const productName = (analysisResult.data?.analysis_result as any)?.name || 'Produit';
            const supplierName = supplierResult.data?.product_name || 'Fournisseur';
            const confidenceScore = link.confidence_score || 100;

            // Toast avec score de confiance
            if (confidenceScore === 100) {
              toast.success(`🔗 Lien créé : ${productName}`, {
                description: `✅ Correspondance EAN parfaite avec ${supplierName}`,
                duration: 2000,
              });
            } else if (confidenceScore >= 85) {
              toast.info(`🔗 Lien créé : ${productName}`, {
                description: `🟡 Correspondance ${confidenceScore}% avec ${supplierName}`,
                duration: 2000,
              });
            }

            // Invalider les caches
            queryClient.invalidateQueries({ queryKey: ['product-links'] });
            queryClient.invalidateQueries({ queryKey: ['global-product-stats'] });
            queryClient.invalidateQueries({ queryKey: ['unlinked-products-count'] });
            queryClient.invalidateQueries({ queryKey: ['supplier-products'] });
            queryClient.invalidateQueries({ queryKey: ['product-analyses'] });
          } catch (error) {
            console.error('[useRealtimeProductLinks] Error fetching link details:', error);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

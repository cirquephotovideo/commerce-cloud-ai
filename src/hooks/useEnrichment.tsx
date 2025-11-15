import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useEnrichment = (productId: string, onSuccess?: () => void) => {
  return useMutation({
    mutationFn: async ({ enrichmentType, provider = 'lovable', webSearchEnabled = false }: { 
      enrichmentType: string[]; 
      provider?: string;
      webSearchEnabled?: boolean;
    }) => {
      // Si "unified_ollama" est demandé, appeler la nouvelle fonction unifiée
      if (enrichmentType.includes('unified_ollama')) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          throw new Error('Session expirée');
        }

        const { data: analysis } = await supabase
          .from('product_analyses')
          .select('*, analysis_result')
          .eq('id', productId)
          .single();

        if (!analysis) {
          throw new Error('Analyse non trouvée');
        }

        const { data, error } = await supabase.functions.invoke('unified-ollama-enrichment', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`
          },
          body: {
            analysisId: productId,
            productData: {
              name: (analysis.analysis_result as any)?.description || 'Produit',
              brand: (analysis.analysis_result as any)?.brand,
              ean: analysis.ean,
              supplier_reference: (analysis.analysis_result as any)?.supplier_reference
            },
            purchasePrice: analysis.purchase_price
          }
        });

        if (error) {
          console.error('[useEnrichment] Erreur unified Ollama:', error);
          throw new Error(error.message || 'Erreur lors de l\'enrichissement unifié');
        }
        
        if (data && !data.success && data.error) {
          throw new Error(data.error);
        }
        
        return data;
      }
      
      // Si "rsgp_ollama" est dans enrichmentType, appeler la fonction dédiée
      if (enrichmentType.includes('rsgp_ollama')) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          throw new Error('Session expirée');
        }

        const { data: analysis } = await supabase
          .from('product_analyses')
          .select('*, analysis_result')
          .eq('id', productId)
          .single();

        if (!analysis) {
          throw new Error('Analyse non trouvée');
        }

        const { data, error } = await supabase.functions.invoke('rsgp-compliance-ollama', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`
          },
          body: {
            analysisId: productId,
            productData: {
              name: (analysis.analysis_result as any)?.description || 'Produit',
              brand: (analysis.analysis_result as any)?.brand,
              ean: analysis.ean,
              supplier_reference: (analysis.analysis_result as any)?.supplier_reference
            },
            purchasePrice: analysis.purchase_price,
            preferred_model: 'qwen3-coder:480b-cloud',
            web_search_enabled: true
          }
        });

        if (error) {
          console.error('[useEnrichment] Erreur RSGP Ollama:', error);
          throw new Error(error.message || 'Erreur lors de l\'analyse RSGP');
        }
        
        if (data && !data.success && data.error) {
          throw new Error(data.error);
        }
        
        return data;
      }
      
      // Si "odoo_attributes" est dans enrichmentType, appeler la fonction dédiée
      if (enrichmentType.includes('odoo_attributes')) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          throw new Error('Session expirée');
        }

        const { data, error } = await supabase.functions.invoke('enrich-odoo-attributes', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`
          },
          body: {
            analysisId: productId,
            provider,
            webSearchEnabled
          }
        });

        if (error) {
          console.error('[useEnrichment] Erreur Odoo attributes:', error);
          throw new Error(error.message || 'Erreur lors de l\'enrichissement des attributs Odoo');
        }
        
        if (data && !data.success && data.error) {
          throw new Error(data.error + (data.suggestedAction ? `\n\n💡 ${data.suggestedAction}` : ''));
        }
        
        return data;
      }

      // Sinon, appeler la fonction d'enrichissement normale
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Session expirée');
      }

      const { data, error } = await supabase.functions.invoke('re-enrich-product', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        },
        body: {
          productId,
          enrichmentTypes: enrichmentType,
          provider
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('✨ Enrichissement démarré !');
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast.error('❌ Erreur d\'enrichissement', { 
        description: error.message,
        duration: 8000
      });
    }
  });
};

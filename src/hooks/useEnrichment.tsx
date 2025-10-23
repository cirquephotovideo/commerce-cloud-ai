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

        if (error) throw error;
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
      toast.error(`❌ Erreur : ${error.message}`);
    }
  });
};

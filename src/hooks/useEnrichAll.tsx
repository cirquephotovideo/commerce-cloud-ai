import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useEnrichAll = (analysisId: string, onSuccess?: () => void) => {
  return useMutation({
    mutationFn: async ({ sections }: { sections: string[] }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Session expirée');
      }

      const { data, error } = await supabase.functions.invoke('enrich-all-sections', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        },
        body: {
          analysisId,
          sections
        }
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      const successCount = data.successCount || 0;
      const totalCount = data.totalCount || 0;
      
      toast.success(`✨ Enrichissement terminé: ${successCount}/${totalCount} sections enrichies avec succès`);
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast.error('❌ Erreur d\'enrichissement', { 
        description: error.message 
      });
    }
  });
};

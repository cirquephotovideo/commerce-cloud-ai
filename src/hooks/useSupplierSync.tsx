import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useSupplierSync = () => {
  const queryClient = useQueryClient();

  const syncSingleProduct = useMutation({
    mutationFn: async (productId: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Session expirée');
      }

      const { data, error } = await supabase.functions.invoke('supplier-sync-single-product', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        },
        body: { productId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('✅ Produit synchronisé avec succès');
      queryClient.invalidateQueries({ queryKey: ['supplier-products'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-prices'] });
    },
    onError: (error: Error) => {
      toast.error(`❌ Erreur de synchronisation : ${error.message}`);
    }
  });

  const fixStuckEnrichments = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Session expirée');
      }

      const { data, error } = await supabase.functions.invoke('fix-stuck-enrichments', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`✅ ${data.fixed} produits débloqués, ${data.tasks_created} tâches créées`);
      queryClient.invalidateQueries({ queryKey: ['supplier-products'] });
      queryClient.invalidateQueries({ queryKey: ['enrichment-queue'] });
    },
    onError: (error: Error) => {
      toast.error(`❌ Erreur : ${error.message}`);
    }
  });

  return {
    syncSingleProduct,
    fixStuckEnrichments,
    isSyncing: syncSingleProduct.isPending,
    isFixing: fixStuckEnrichments.isPending,
  };
};

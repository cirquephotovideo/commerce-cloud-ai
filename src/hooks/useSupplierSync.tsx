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
      const { data, error } = await supabase.functions.invoke('fix-stuck-enrichments');
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

  const retryFailedEnrichments = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('retry-failed-enrichments');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`✅ ${data.retried} produits réinitialisés`);
      queryClient.invalidateQueries({ queryKey: ['supplier-products'] });
    },
    onError: (error: Error) => {
      toast.error(`❌ Erreur : ${error.message}`);
    }
  });

  const pauseEnrichments = useMutation({
    mutationFn: async (paused: boolean) => {
      const { error } = await supabase
        .from('system_settings')
        .upsert({ key: 'enrichment_paused', value: { paused } });
      if (error) throw error;
      return paused;
    },
    onSuccess: (paused) => {
      toast.success(paused ? '⏸️ Enrichissements en pause' : '▶️ Enrichissements repris');
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
    },
    onError: (error: Error) => {
      toast.error(`❌ Erreur : ${error.message}`);
    }
  });

  const skipFailedProducts = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('supplier_products')
        .update({ enrichment_status: 'skipped' })
        .eq('enrichment_status', 'failed');
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('✅ Produits en erreur ignorés');
      queryClient.invalidateQueries({ queryKey: ['supplier-products'] });
    },
    onError: (error: Error) => {
      toast.error(`❌ Erreur : ${error.message}`);
    }
  });

  return {
    syncSingleProduct,
    fixStuckEnrichments,
    retryFailedEnrichments,
    pauseEnrichments,
    skipFailedProducts,
    isSyncing: syncSingleProduct.isPending,
    isFixing: fixStuckEnrichments.isPending,
    isRetrying: retryFailedEnrichments.isPending,
    isPausing: pauseEnrichments.isPending,
    isSkipping: skipFailedProducts.isPending,
  };
};

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
      const { data, error } = await supabase.functions.invoke('emergency-recover-enrichments');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-products'] });
      queryClient.invalidateQueries({ queryKey: ['enrichment-queue'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-health'] });
      
      // Show detailed success message
      if (data?.success) {
        toast.success(data.message || 'Récupération d\'urgence terminée', {
          description: `${data.final_status?.products_pending || 0} produits réinitialisés, ${data.final_status?.queue_tasks || 0} tâches en file`
        });
      }
    },
    onError: (error: Error) => {
      toast.error('Erreur lors de la récupération d\'urgence', {
        description: error.message
      });
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

  const cleanupAndResync = useMutation({
    mutationFn: async ({ resyncOdoo = true }: { resyncOdoo?: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data, error } = await supabase.functions.invoke('cleanup-and-resync', {
        body: { userId: user.id, resyncOdoo },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      console.log('✅ Cleanup success:', data);
      toast.success(
        `Nettoyage terminé: ${data.mergeResult?.merged_eans || 0} doublons fusionnés, ${data.variantsCreated} prix restaurés`
      );
      queryClient.invalidateQueries({ queryKey: ['supplier-products'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-prices'] });
      queryClient.invalidateQueries({ queryKey: ['product-analyses'] });
    },
    onError: (error: Error) => {
      console.error('❌ Cleanup error:', error);
      toast.error(`Erreur nettoyage: ${error.message}`);
    },
  });

  return {
    syncSingleProduct,
    fixStuckEnrichments,
    retryFailedEnrichments,
    pauseEnrichments,
    skipFailedProducts,
    cleanupAndResync,
    isSyncing: syncSingleProduct.isPending,
    isFixing: fixStuckEnrichments.isPending,
    isRetrying: retryFailedEnrichments.isPending,
    isPausing: pauseEnrichments.isPending,
    isSkipping: skipFailedProducts.isPending,
    isCleaning: cleanupAndResync.isPending,
  };
};

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const useRealtimeImportExportStats = () => {
  const queryClient = useQueryClient();
  const [liveStats, setLiveStats] = useState({
    totalImports: 0,
    successfulExports: 0,
    pendingEnrichments: 0,
    errors: 0,
  });

  useEffect(() => {
    // S'abonner aux changements des logs d'import
    const importLogsChannel = supabase
      .channel('import-logs-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'supplier_import_logs',
        },
        () => {
          console.log('📥 New import logged');
          setLiveStats(prev => ({ ...prev, totalImports: prev.totalImports + 1 }));
          queryClient.invalidateQueries({ queryKey: ['import-export-stats'] });
          queryClient.invalidateQueries({ queryKey: ['recent-activity'] });
        }
      )
      .subscribe();

    // S'abonner aux changements d'historique d'export
    const exportHistoryChannel = supabase
      .channel('export-history-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'export_history',
        },
        (payload) => {
          console.log('📤 New export logged:', payload.new);
          const isSuccess = (payload.new as any).status === 'success';
          const isError = (payload.new as any).status === 'failed';
          
          if (isSuccess) {
            setLiveStats(prev => ({ ...prev, successfulExports: prev.successfulExports + 1 }));
          }
          if (isError) {
            setLiveStats(prev => ({ ...prev, errors: prev.errors + 1 }));
          }
          
          queryClient.invalidateQueries({ queryKey: ['import-export-stats'] });
          queryClient.invalidateQueries({ queryKey: ['recent-activity'] });
        }
      )
      .subscribe();

    // S'abonner aux changements de statut des produits
    const supplierProductsChannel = supabase
      .channel('supplier-products-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'supplier_products',
        },
        (payload) => {
          const oldStatus = (payload.old as any)?.enrichment_status;
          const newStatus = (payload.new as any)?.enrichment_status;
          
          if (oldStatus !== 'pending' && newStatus === 'pending') {
            setLiveStats(prev => ({ ...prev, pendingEnrichments: prev.pendingEnrichments + 1 }));
          } else if (oldStatus === 'pending' && newStatus !== 'pending') {
            setLiveStats(prev => ({ ...prev, pendingEnrichments: Math.max(0, prev.pendingEnrichments - 1) }));
          }
          
          queryClient.invalidateQueries({ queryKey: ['import-export-stats'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'supplier_products',
        },
        (payload) => {
          const status = (payload.new as any)?.enrichment_status;
          if (status === 'pending') {
            setLiveStats(prev => ({ ...prev, pendingEnrichments: prev.pendingEnrichments + 1 }));
          }
          queryClient.invalidateQueries({ queryKey: ['import-export-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(importLogsChannel);
      supabase.removeChannel(exportHistoryChannel);
      supabase.removeChannel(supplierProductsChannel);
    };
  }, [queryClient]);

  return { liveStats, setLiveStats };
};

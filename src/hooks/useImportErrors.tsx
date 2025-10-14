import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ImportError {
  id: string;
  user_id: string;
  supplier_id: string | null;
  import_job_id: string | null;
  error_type: string;
  error_message: string;
  error_details: any;
  product_reference: string | null;
  retry_count: number;
  max_retries: number;
  last_retry_at: string | null;
  resolved_at: string | null;
  resolution_method: string | null;
  created_at: string;
  updated_at: string;
}

export const useImportErrors = (resolvedFilter: 'all' | 'unresolved' | 'resolved' = 'unresolved') => {
  return useQuery({
    queryKey: ['import-errors', resolvedFilter],
    queryFn: async () => {
      let query = supabase
        .from('import_errors')
        .select('*')
        .order('created_at', { ascending: false });

      if (resolvedFilter === 'unresolved') {
        query = query.is('resolved_at', null);
      } else if (resolvedFilter === 'resolved') {
        query = query.not('resolved_at', 'is', null);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching import errors:', error);
        throw error;
      }

      return data as ImportError[];
    },
    refetchInterval: 30000, // Refresh every 30s
  });
};

export const useRetryableErrors = () => {
  return useQuery({
    queryKey: ['retryable-import-errors'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_retryable_import_errors');

      if (error) {
        console.error('Error fetching retryable errors:', error);
        throw error;
      }

      return data;
    },
    refetchInterval: 60000, // Refresh every minute
  });
};

export const useImportErrorStats = () => {
  return useQuery({
    queryKey: ['import-error-stats'],
    queryFn: async () => {
      const { count: unresolvedCount, error: unresolvedError } = await supabase
        .from('import_errors')
        .select('*', { count: 'exact', head: true })
        .is('resolved_at', null);

      const { data: retryableData, error: retryableError } = await supabase
        .from('import_errors')
        .select('retry_count, max_retries')
        .is('resolved_at', null);

      if (unresolvedError || retryableError) {
        console.error('Error fetching stats:', unresolvedError || retryableError);
        return { unresolved: 0, retryable: 0 };
      }

      const retryableCount = retryableData?.filter(
        item => item.retry_count < item.max_retries
      ).length || 0;

      return {
        unresolved: unresolvedCount || 0,
        retryable: retryableCount,
      };
    },
    refetchInterval: 30000,
  });
};

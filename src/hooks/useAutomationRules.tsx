import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AutomationRule {
  id: string;
  user_id: string;
  rule_name: string;
  rule_description?: string;
  rule_category: 'import' | 'cleanup' | 'enrichment' | 'export' | 'sync' | 'linking';
  is_active: boolean;
  priority: number;
  trigger_type: 'schedule' | 'event' | 'webhook' | 'manual';
  trigger_config: any;
  conditions: any;
  source_config: any;
  actions: any[];
  retry_config: any;
  on_error_action: 'log' | 'alert' | 'stop' | 'continue';
  trigger_count: number;
  success_count: number;
  error_count: number;
  last_triggered_at?: string;
  last_success_at?: string;
  last_error_at?: string;
  last_error_message?: string;
  cleanup_after_days?: number;
  archive_results: boolean;
  created_at: string;
  updated_at: string;
}

export const useAutomationRules = (category?: string) => {
  const queryClient = useQueryClient();

  // Fetch automation rules
  const { data: rules, isLoading, error, refetch } = useQuery({
    queryKey: ['automation-rules', category],
    queryFn: async () => {
      let query = supabase
        .from('automation_master_rules')
        .select('*')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false });

      if (category) {
        query = query.eq('rule_category', category);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as AutomationRule[];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Create automation rule
  const createRule = useMutation({
    mutationFn: async (newRule: Omit<AutomationRule, 'id' | 'created_at' | 'updated_at' | 'trigger_count' | 'success_count' | 'error_count' | 'last_triggered_at' | 'last_success_at' | 'last_error_at' | 'last_error_message'>) => {
      const { data, error } = await supabase
        .from('automation_master_rules')
        .insert([newRule as any])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      toast.success('Règle d\'automatisation créée avec succès');
    },
    onError: (error: any) => {
      toast.error(`Erreur lors de la création : ${error.message}`);
    },
  });

  // Update automation rule
  const updateRule = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AutomationRule> }) => {
      const { data, error } = await supabase
        .from('automation_master_rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      toast.success('Règle mise à jour');
    },
    onError: (error: any) => {
      toast.error(`Erreur lors de la mise à jour : ${error.message}`);
    },
  });

  // Delete automation rule
  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('automation_master_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      toast.success('Règle supprimée');
    },
    onError: (error: any) => {
      toast.error(`Erreur lors de la suppression : ${error.message}`);
    },
  });

  // Toggle rule active status
  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('automation_master_rules')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      toast.success('Statut mis à jour');
    },
    onError: (error: any) => {
      toast.error(`Erreur : ${error.message}`);
    },
  });

  return {
    rules,
    isLoading,
    error,
    refetch,
    createRule,
    updateRule,
    deleteRule,
    toggleActive,
  };
};
